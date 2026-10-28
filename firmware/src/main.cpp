#include <Arduino.h>
#include <WiFi.h>
#include <esp_camera.h>
#include <esp_sleep.h>
#include <FS.h>
#include <SD_MMC.h>

#include "backend_client.h"
#include "camera_pins.h"
#include "device_config.h"
#include "device_store.h"
#include "ntp_time.h"
#include "provisioning.h"

// LED RGB de la placa (WS2812). Conserva el último color mientras tenga corriente, incluso tras
// un reinicio (el firmware de fábrica lo dejaba encendido), así que se apaga al arrancar.
#define RGB_LED_PIN 48

// Sobrevive al deep sleep (la RAM normal no).
RTC_DATA_ATTR static int photoCounter = 0;

static bool sdReady = false;
static DeviceConfig currentConfig;
static DeviceStore deviceStore;

// Tiempo que se deja al sensor para ajustar exposición y balance de blancos tras encenderlo.
static const uint32_t CAMERA_SETTLE_MS = 3000;

// La cámara se enciende en cada foto ya con la resolución de la config y se apaga después.
// Encenderla a 5 MP y cambiarla luego (set_framesize) dejaba fotogramas viejos a 5 MP en el
// doble búfer: la primera foto tras arrancar salía a 2560x1920 aunque el driver dijera 1600x1200.
static bool initCamera(framesize_t frameSize) {
  camera_config_t config = {};
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer = LEDC_TIMER_0;
  config.pin_d0 = CAM_PIN_D0;
  config.pin_d1 = CAM_PIN_D1;
  config.pin_d2 = CAM_PIN_D2;
  config.pin_d3 = CAM_PIN_D3;
  config.pin_d4 = CAM_PIN_D4;
  config.pin_d5 = CAM_PIN_D5;
  config.pin_d6 = CAM_PIN_D6;
  config.pin_d7 = CAM_PIN_D7;
  config.pin_xclk = CAM_PIN_XCLK;
  config.pin_pclk = CAM_PIN_PCLK;
  config.pin_vsync = CAM_PIN_VSYNC;
  config.pin_href = CAM_PIN_HREF;
  config.pin_sccb_sda = CAM_PIN_SIOD;
  config.pin_sccb_scl = CAM_PIN_SIOC;
  config.pin_pwdn = CAM_PIN_PWDN;
  config.pin_reset = CAM_PIN_RESET;
  config.xclk_freq_hz = 20000000;
  config.pixel_format = PIXFORMAT_JPEG;

  if (psramFound()) {
    config.frame_size = frameSize;
    config.jpeg_quality = 10;
    config.fb_count = 2;
    config.fb_location = CAMERA_FB_IN_PSRAM;
    config.grab_mode = CAMERA_GRAB_LATEST;  // la foto es la última, no una de antes de ajustar la exposición
  } else {
    config.frame_size = FRAMESIZE_SVGA;
    config.jpeg_quality = 12;
    config.fb_count = 1;
    config.fb_location = CAMERA_FB_IN_DRAM;
  }

  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("Fallo al iniciar la cámara: 0x%x\n", err);
    return false;
  }
  return true;
}

static bool initSdCard() {
  SD_MMC.setPins(SD_MMC_CLK, SD_MMC_CMD, SD_MMC_D0);
  if (!SD_MMC.begin("/sdcard", true)) {  // modo 1-bit
    Serial.println("No se detectó tarjeta SD, se seguirá solo por serial.");
    return false;
  }
  return true;
}

static void captureAndUpload() {
  framesize_t frameSize;
  if (!resolutionToFramesize(currentConfig.resolution, frameSize)) {
    Serial.println("Resolución desconocida, se usa UXGA: " + currentConfig.resolution);
    frameSize = FRAMESIZE_UXGA;
  }

  if (!initCamera(frameSize)) {
    Serial.println("La cámara no inició, no se captura esta vez.");
    return;
  }
  delay(CAMERA_SETTLE_MS);

  camera_fb_t *fb = esp_camera_fb_get();
  if (!fb) {
    Serial.println("Captura fallida: frame buffer vacío.");
    esp_camera_deinit();
    return;
  }

  Serial.printf("Foto %d capturada: %u bytes (%ux%u)\n", photoCounter, fb->len, fb->width, fb->height);

  if (sdReady) {
    char path[32];
    snprintf(path, sizeof(path), "/photo_%05d.jpg", photoCounter);
    File file = SD_MMC.open(path, FILE_WRITE);
    if (file) {
      file.write(fb->buf, fb->len);
      file.close();
    } else {
      Serial.println("No se pudo abrir el archivo en la SD.");
    }
  }

  // La foto se copia y la cámara se apaga antes de subirla: así su reloj (XCLK), su DMA y su
  // consumo no coinciden con la transmisión WiFi.
  size_t len = fb->len;
  uint8_t *jpeg = (uint8_t *)ps_malloc(len);
  if (!jpeg) {
    Serial.println("Sin memoria para copiar la foto.");
    esp_camera_fb_return(fb);
    esp_camera_deinit();
    return;
  }
  memcpy(jpeg, fb->buf, len);
  esp_camera_fb_return(fb);
  esp_camera_deinit();

  uploadPhoto(jpeg, len, deviceStore);
  free(jpeg);
  photoCounter++;
}

static void refreshConfig() {
  DeviceConfig fetched;
  if (!fetchDeviceConfig(fetched, deviceStore)) {
    Serial.println("No se pudo refrescar la config, se mantiene la anterior.");
    return;
  }
  currentConfig = fetched;
  Serial.printf("Config: modo=%s intervalo=%us resolución=%s horario=%02d:%02d-%02d:%02d activo=%d\n",
                currentConfig.powerMode.c_str(), currentConfig.intervalSeconds, currentConfig.resolution.c_str(),
                currentConfig.scheduleStartHour, currentConfig.scheduleStartMinute, currentConfig.scheduleEndHour,
                currentConfig.scheduleEndMinute, currentConfig.isActive);
}

static void runCycle() {
  // La config va primero: el horario y la resolución mandan sobre la foto de este ciclo.
  refreshConfig();

  if (currentConfig.isActive && isWithinSchedule(currentConfig)) {
    captureAndUpload();
  } else {
    Serial.println("Fuera de la ventana horaria o dispositivo inactivo, no se captura esta vez.");
  }
}

static void goToSleepUntilNextCycle() {
  uint32_t sleepSeconds = currentConfig.intervalSeconds;

  if (!isWithinSchedule(currentConfig)) {
    uint32_t minsUntilStart = minutesUntil(currentConfig.scheduleStartHour, currentConfig.scheduleStartMinute);
    sleepSeconds = minsUntilStart * 60UL;
  }

  Serial.printf("Durmiendo %us (modo batería)\n", sleepSeconds);
  Serial.flush();
  esp_sleep_enable_timer_wakeup((uint64_t)sleepSeconds * 1000000ULL);
  esp_deep_sleep_start();
  // No continúa: el chip se reinicia y vuelve a ejecutar setup() al despertar.
}

void setup() {
  Serial.begin(115200);
  neopixelWrite(RGB_LED_PIN, 0, 0, 0);
  delay(1000);

  sdReady = initSdCard();

  loadDeviceStore(deviceStore);

  if (runProvisioning(deviceStore)) {
    syncTime();
  } else {
    Serial.println("WiFi o registro del dispositivo no disponibles, este ciclo puede fallar al subir.");
  }

  runCycle();

  if (currentConfig.powerMode == "battery") {
    goToSleepUntilNextCycle();
  }
}

void loop() {
  // Solo se llega aquí en modo "mains" (enchufado); en modo batería setup()
  // termina en deep sleep y el chip se reinicia en cada ciclo.
  delay(currentConfig.intervalSeconds * 1000UL);

  // Sin WiFi o sin alta (portal caducado, servidor caído al arrancar...) el ciclo no puede
  // hacer nada: se reinicia para repetir la conexión y el registro.
  if (WiFi.status() != WL_CONNECTED || !deviceStore.hasIdentity()) {
    Serial.println("Sin WiFi o sin alta en el servidor: reinicio para reintentar.");
    delay(100);
    ESP.restart();
  }

  runCycle();
}

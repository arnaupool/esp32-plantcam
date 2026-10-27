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

// Sobrevive al deep sleep (la RAM normal no).
RTC_DATA_ATTR static int photoCounter = 0;

static bool sdReady = false;
static DeviceConfig currentConfig;
static DeviceStore deviceStore;

static bool initCamera() {
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
    config.frame_size = FRAMESIZE_QSXGA;  // 5MP máx del OV5640
    config.jpeg_quality = 10;
    config.fb_count = 2;
    config.fb_location = CAMERA_FB_IN_PSRAM;
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
  camera_fb_t *fb = esp_camera_fb_get();
  if (!fb) {
    Serial.println("Captura fallida: frame buffer vacío.");
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

  uploadPhoto(fb, deviceStore);
  esp_camera_fb_return(fb);
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

// Resolución que tiene el sensor ahora. Vacía = la que dejó initCamera(). En modo batería
// el chip se reinicia en cada ciclo, así que se vuelve a aplicar en cada despertar.
static String sensorResolution = "";

static void applyResolutionIfNeeded() {
  if (currentConfig.resolution == sensorResolution) return;
  if (!applyResolution(currentConfig.resolution)) return;
  sensorResolution = currentConfig.resolution;

  // El primer fotograma tras cambiar de tamaño puede salir con el tamaño anterior: se descarta.
  camera_fb_t *fb = esp_camera_fb_get();
  if (fb) esp_camera_fb_return(fb);
}

static void runCycle() {
  // La config va primero: el horario y la resolución mandan sobre la foto de este ciclo.
  refreshConfig();

  if (currentConfig.isActive && isWithinSchedule(currentConfig)) {
    applyResolutionIfNeeded();
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
  delay(1000);

  if (!initCamera()) {
    Serial.println("Deteniendo: la cámara no inició.");
    return;
  }
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
  runCycle();
}

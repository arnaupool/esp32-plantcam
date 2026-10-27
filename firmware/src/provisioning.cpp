#include "provisioning.h"

#include <ArduinoJson.h>
#include <HTTPClient.h>
#include <WiFi.h>
#include <WiFiManager.h>

#include "config.h"

#define FACTORY_RESET_PIN 0  // botón BOOT en la mayoría de placas ESP32-S3

void checkFactoryResetButton() {
  pinMode(FACTORY_RESET_PIN, INPUT_PULLUP);
  if (digitalRead(FACTORY_RESET_PIN) != LOW) return;

  Serial.println("Botón BOOT pulsado, comprobando si se mantiene 3s para reset de fábrica...");
  uint32_t start = millis();
  while (digitalRead(FACTORY_RESET_PIN) == LOW) {
    if (millis() - start > 3000) {
      Serial.println("Reset de fábrica: borrando WiFi + configuración guardada.");
      factoryReset();
      delay(500);
      ESP.restart();
    }
    delay(50);
  }
}

static String defaultDeviceName() {
  uint64_t mac = ESP.getEfuseMac();
  char buf[24];
  snprintf(buf, sizeof(buf), "PlantCam-%04X", (uint16_t)(mac & 0xFFFF));
  return String(buf);
}

static bool connectWifiWithPortal(DeviceStore &store) {
  WiFiManager wm;

  WiFiManagerParameter backendParam(
      "backend_url", "URL del backend (ej: http://192.168.1.50:8000)", store.backendUrl.c_str(), 120);
  wm.addParameter(&backendParam);

  wm.setConfigPortalTimeout(300);  // 5 min, luego reintenta solo por si ya hay WiFi guardado

  bool connected = wm.autoConnect("PlantCam-Setup");
  if (!connected) {
    Serial.println("No se pudo conectar al WiFi ni completar el portal cautivo.");
    return false;
  }

  String enteredUrl = String(backendParam.getValue());
  enteredUrl.trim();
  if (enteredUrl.length() > 0 && enteredUrl != store.backendUrl) {
    saveBackendUrl(enteredUrl);
    store.backendUrl = enteredUrl;
  }

  return true;
}

static bool registerDevice(DeviceStore &store) {
  if (store.backendUrl.length() == 0) {
    Serial.println("No hay URL de backend configurada, no se puede registrar el dispositivo.");
    return false;
  }

  HTTPClient http;
  http.begin(store.backendUrl + "/devices/register");
  http.addHeader("Content-Type", "application/json");

  JsonDocument doc;
  doc["provisioning_secret"] = PROVISIONING_SECRET;
  doc["name"] = defaultDeviceName();
  String body;
  serializeJson(doc, body);

  int code = http.POST(body);
  if (code != 201) {
    Serial.printf("Fallo al auto-registrar el dispositivo, HTTP %d: %s\n", code, http.getString().c_str());
    http.end();
    return false;
  }

  JsonDocument resp;
  DeserializationError err = deserializeJson(resp, http.getString());
  http.end();
  if (err) {
    Serial.printf("Respuesta de registro inválida: %s\n", err.c_str());
    return false;
  }

  String id = String((const char *)resp["id"]);
  String key = String((const char *)resp["api_key"]);
  saveDeviceIdentity(id, key);
  store.deviceId = id;
  store.apiKey = key;

  Serial.println("Dispositivo auto-registrado: " + id);
  return true;
}

bool runProvisioning(DeviceStore &store) {
  checkFactoryResetButton();

  if (!connectWifiWithPortal(store)) {
    return false;
  }
  // Sin modo ahorro: en el S3 viene activado por defecto y atasca la subida de fotos grandes.
  WiFi.setSleep(false);
  Serial.printf("WiFi conectado: %s (RSSI %d dBm)\n", WiFi.localIP().toString().c_str(), WiFi.RSSI());

  if (store.hasIdentity()) {
    return true;
  }

  return registerDevice(store);
}

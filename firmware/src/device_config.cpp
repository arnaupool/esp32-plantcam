#include "device_config.h"

#include <ArduinoJson.h>
#include <HTTPClient.h>
#include <WiFi.h>

#include "config.h"
#include "ntp_time.h"

static bool parseTime(const char *hhmmss, uint8_t &hour, uint8_t &minute) {
  if (!hhmmss || strlen(hhmmss) < 5) return false;
  hour = (hhmmss[0] - '0') * 10 + (hhmmss[1] - '0');
  minute = (hhmmss[3] - '0') * 10 + (hhmmss[4] - '0');
  return true;
}

bool fetchDeviceConfig(DeviceConfig &out, const DeviceStore &store) {
  if (WiFi.status() != WL_CONNECTED || !store.hasIdentity()) return false;

  HTTPClient http;
  String url = store.backendUrl + "/devices/" + store.deviceId + "/config";
  http.begin(url);
  http.addHeader("X-API-Key", store.apiKey);

  int code = http.GET();
  if (code != 200) {
    Serial.printf("Fallo al pedir config, HTTP %d\n", code);
    http.end();
    return false;
  }

  String body = http.getString();
  http.end();

  JsonDocument doc;
  DeserializationError err = deserializeJson(doc, body);
  if (err) {
    Serial.printf("Config JSON inválido: %s\n", err.c_str());
    return false;
  }

  out.isActive = doc["is_active"] | true;
  out.powerMode = String((const char *)(doc["power_mode"] | "mains"));
  out.intervalSeconds = doc["interval_seconds"] | out.intervalSeconds;
  out.resolution = String((const char *)(doc["resolution"] | "UXGA"));

  const char *start = doc["schedule_start"];
  const char *end = doc["schedule_end"];
  parseTime(start, out.scheduleStartHour, out.scheduleStartMinute);
  parseTime(end, out.scheduleEndHour, out.scheduleEndMinute);

  return true;
}

bool isWithinSchedule(const DeviceConfig &config) {
  LocalTime now;
  if (!getLocalTime2(now)) return true;  // fail-open: mejor capturar de más que dejar de capturar por un fallo NTP

  int nowMinutes = now.hour * 60 + now.minute;
  int startMinutes = config.scheduleStartHour * 60 + config.scheduleStartMinute;
  int endMinutes = config.scheduleEndHour * 60 + config.scheduleEndMinute;

  if (startMinutes <= endMinutes) {
    return nowMinutes >= startMinutes && nowMinutes < endMinutes;
  }
  // ventana que cruza medianoche (ej. 22:00-06:00)
  return nowMinutes >= startMinutes || nowMinutes < endMinutes;
}

bool applyResolution(const String &resolution) {
  sensor_t *sensor = esp_camera_sensor_get();
  if (!sensor) return false;

  framesize_t size;
  if (resolution == "QSXGA") size = FRAMESIZE_QSXGA;
  else if (resolution == "UXGA") size = FRAMESIZE_UXGA;
  else if (resolution == "SXGA") size = FRAMESIZE_SXGA;
  else if (resolution == "XGA") size = FRAMESIZE_XGA;
  else if (resolution == "SVGA") size = FRAMESIZE_SVGA;
  else if (resolution == "VGA") size = FRAMESIZE_VGA;
  else {
    Serial.println("Resolución desconocida, se mantiene la actual: " + resolution);
    return false;
  }

  return sensor->set_framesize(sensor, size) == 0;
}

#pragma once

#include <Arduino.h>
#include <esp_camera.h>

#include "device_store.h"

struct DeviceConfig {
  bool isActive = true;
  String powerMode = "mains";
  uint32_t intervalSeconds = 600;
  uint8_t scheduleStartHour = 7;
  uint8_t scheduleStartMinute = 0;
  uint8_t scheduleEndHour = 21;
  uint8_t scheduleEndMinute = 0;
  String resolution = "UXGA";
};

// true si la hora local actual cae dentro de [scheduleStart, scheduleEnd).
// Si no hay hora sincronizada, asume que sí está dentro (fail-open).
bool isWithinSchedule(const DeviceConfig &config);

// Pide /devices/{id}/config al backend y rellena out. Devuelve false si falla la petición.
bool fetchDeviceConfig(DeviceConfig &out, const DeviceStore &store);

// Traduce el string de resolución (ej. "UXGA") a framesize_t. Devuelve false si no la conoce.
bool resolutionToFramesize(const String &resolution, framesize_t &out);

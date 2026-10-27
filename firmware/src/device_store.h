#pragma once

#include <Arduino.h>

// Todo lo que antes vivía hardcodeado en config.h y ahora se auto-configura
// una vez y se persiste en NVS (sobrevive a reflasheos de la misma partición
// de datos, y por supuesto a reinicios/deep sleep).
struct DeviceStore {
  String backendUrl;
  String deviceId;
  String apiKey;

  bool hasIdentity() const { return deviceId.length() > 0 && apiKey.length() > 0; }
};

void loadDeviceStore(DeviceStore &out);
void saveBackendUrl(const String &url);
void saveDeviceIdentity(const String &deviceId, const String &apiKey);

// Borra WiFi + todo lo anterior. Fuerza el portal cautivo + auto-registro
// completo en el siguiente arranque.
void factoryReset();

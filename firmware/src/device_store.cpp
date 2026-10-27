#include "device_store.h"

#include <Preferences.h>
#include <WiFi.h>

static const char *NAMESPACE = "plantcam";

void loadDeviceStore(DeviceStore &out) {
  Preferences prefs;
  prefs.begin(NAMESPACE, true);
  out.backendUrl = prefs.getString("backend_url", "");
  out.deviceId = prefs.getString("device_id", "");
  out.apiKey = prefs.getString("api_key", "");
  prefs.end();
}

void saveBackendUrl(const String &url) {
  Preferences prefs;
  prefs.begin(NAMESPACE, false);
  prefs.putString("backend_url", url);
  prefs.end();
}

void saveDeviceIdentity(const String &deviceId, const String &apiKey) {
  Preferences prefs;
  prefs.begin(NAMESPACE, false);
  prefs.putString("device_id", deviceId);
  prefs.putString("api_key", apiKey);
  prefs.end();
}

void factoryReset() {
  Preferences prefs;
  prefs.begin(NAMESPACE, false);
  prefs.clear();
  prefs.end();
  WiFi.disconnect(true, true);  // también borra las credenciales WiFi guardadas por el core
}

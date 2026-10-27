#include "backend_client.h"

#include <HTTPClient.h>
#include <WiFi.h>

static const char *BOUNDARY = "PlantCamBoundary7c3f9a";

bool uploadPhoto(camera_fb_t *fb, const DeviceStore &store) {
  if (WiFi.status() != WL_CONNECTED || !store.hasIdentity()) return false;

  String head = "--" + String(BOUNDARY) +
                "\r\nContent-Disposition: form-data; name=\"file\"; filename=\"photo.jpg\""
                "\r\nContent-Type: image/jpeg\r\n\r\n";
  String tail = "\r\n--" + String(BOUNDARY) + "--\r\n";

  size_t totalLen = head.length() + fb->len + tail.length();
  uint8_t *body = (uint8_t *)malloc(totalLen);
  if (!body) {
    Serial.println("Sin memoria para el cuerpo del POST");
    return false;
  }

  size_t offset = 0;
  memcpy(body + offset, head.c_str(), head.length());
  offset += head.length();
  memcpy(body + offset, fb->buf, fb->len);
  offset += fb->len;
  memcpy(body + offset, tail.c_str(), tail.length());

  HTTPClient http;
  String url = store.backendUrl + "/devices/" + store.deviceId + "/photos";
  http.begin(url);
  http.addHeader("X-API-Key", store.apiKey);
  http.addHeader("Content-Type", "multipart/form-data; boundary=" + String(BOUNDARY));

  int code = http.POST(body, totalLen);
  free(body);

  if (code == 201) {
    Serial.println("Foto subida OK: " + http.getString());
  } else {
    Serial.printf("Fallo al subir foto, HTTP %d: %s\n", code, http.getString().c_str());
  }

  http.end();
  return code == 201;
}

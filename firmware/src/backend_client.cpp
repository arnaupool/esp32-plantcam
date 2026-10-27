#include "backend_client.h"

#include <HTTPClient.h>
#include <WiFi.h>

static const char *BOUNDARY = "PlantCamBoundary7c3f9a";
static const int UPLOAD_ATTEMPTS = 2;

// Solo se reintenta si la petición no llegó entera al servidor: así no se duplican fotos.
static bool isRetryable(int code) {
  return code == HTTPC_ERROR_CONNECTION_REFUSED || code == HTTPC_ERROR_SEND_PAYLOAD_FAILED ||
         code == HTTPC_ERROR_CONNECTION_LOST;
}

bool uploadPhoto(const uint8_t *jpeg, size_t len, const DeviceStore &store) {
  if (WiFi.status() != WL_CONNECTED || !store.hasIdentity()) return false;

  String head = "--" + String(BOUNDARY) +
                "\r\nContent-Disposition: form-data; name=\"file\"; filename=\"photo.jpg\""
                "\r\nContent-Type: image/jpeg\r\n\r\n";
  String tail = "\r\n--" + String(BOUNDARY) + "--\r\n";

  size_t totalLen = head.length() + len + tail.length();
  uint8_t *body = (uint8_t *)malloc(totalLen);
  if (!body) {
    Serial.println("Sin memoria para el cuerpo del POST");
    return false;
  }

  size_t offset = 0;
  memcpy(body + offset, head.c_str(), head.length());
  offset += head.length();
  memcpy(body + offset, jpeg, len);
  offset += len;
  memcpy(body + offset, tail.c_str(), tail.length());

  String url = store.backendUrl + "/devices/" + store.deviceId + "/photos";
  int code = 0;

  for (int attempt = 1; attempt <= UPLOAD_ATTEMPTS; attempt++) {
    HTTPClient http;
    http.begin(url);
    http.addHeader("X-API-Key", store.apiKey);
    http.addHeader("Content-Type", "multipart/form-data; boundary=" + String(BOUNDARY));

    uint32_t start = millis();
    code = http.POST(body, totalLen);
    uint32_t elapsed = millis() - start;

    if (code == 201) {
      Serial.printf("Foto subida OK (%u bytes en %u ms, RSSI %d dBm)\n", totalLen, elapsed, WiFi.RSSI());
    } else {
      Serial.printf("Fallo al subir foto (intento %d/%d), HTTP %d tras %u ms, RSSI %d dBm: %s\n", attempt,
                    UPLOAD_ATTEMPTS, code, elapsed, WiFi.RSSI(), http.getString().c_str());
    }
    http.end();

    if (code == 201 || !isRetryable(code)) break;
    delay(2000);
  }

  free(body);
  return code == 201;
}

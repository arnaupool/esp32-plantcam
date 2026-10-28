#include "ntp_time.h"

#include <time.h>

#include "config.h"

// Cualquier hora anterior a noviembre de 2023 es el reloj sin sincronizar (cuenta desde 1970).
static const time_t MIN_VALID_EPOCH = 1700000000;

// Se mira el reloj en cada consulta, no una bandera fijada al arrancar: SNTP sigue intentándolo en
// segundo plano, y si la primera respuesta tardaba más que el timeout de syncTime() el horario
// quedaba ignorado para siempre (fail-open) y la placa hacía fotos toda la noche.
static bool clockIsSet() { return time(nullptr) > MIN_VALID_EPOCH; }

bool syncTime(uint32_t timeoutMs) {
  configTime(TIMEZONE_OFFSET_SECONDS, 0, "pool.ntp.org", "time.nist.gov");

  uint32_t start = millis();
  while (!clockIsSet() && millis() - start < timeoutMs) {
    delay(200);
  }

  LocalTime now;
  if (getLocalTime2(now)) {
    Serial.printf("Hora sincronizada: %02d:%02d\n", now.hour, now.minute);
    return true;
  }
  Serial.println("Hora aún sin sincronizar; se seguirá intentando en segundo plano.");
  return false;
}

bool getLocalTime2(LocalTime &out) {
  if (!clockIsSet()) return false;
  time_t now = time(nullptr);
  struct tm tmInfo;
  localtime_r(&now, &tmInfo);
  out.hour = tmInfo.tm_hour;
  out.minute = tmInfo.tm_min;
  return true;
}

uint32_t minutesUntil(uint8_t startHour, uint8_t startMinute) {
  LocalTime now;
  if (!getLocalTime2(now)) return 0;

  int nowMinutes = now.hour * 60 + now.minute;
  int startMinutes = startHour * 60 + startMinute;
  int diff = startMinutes - nowMinutes;
  if (diff <= 0) diff += 24 * 60;
  return (uint32_t)diff;
}

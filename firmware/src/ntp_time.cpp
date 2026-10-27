#include "ntp_time.h"

#include <time.h>

#include "config.h"

static bool timeSynced = false;

bool syncTime(uint32_t timeoutMs) {
  configTime(TIMEZONE_OFFSET_SECONDS, 0, "pool.ntp.org", "time.nist.gov");

  time_t now = time(nullptr);
  uint32_t start = millis();
  while (now < 8 * 3600 * 2 && millis() - start < timeoutMs) {  // esperar a que deje de ser epoch~1970
    delay(200);
    now = time(nullptr);
  }

  timeSynced = now > 8 * 3600 * 2;
  return timeSynced;
}

bool getLocalTime2(LocalTime &out) {
  if (!timeSynced) return false;
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

#pragma once

#include <Arduino.h>

// Sincroniza hora vía NTP. TIMEZONE_OFFSET_SECONDS se define en config.h
// (sin DST automático: ajusta el offset a mano si cambia el horario).
bool syncTime(uint32_t timeoutMs = 10000);

// Hora local actual. Devuelve false mientras el reloj no esté sincronizado.
struct LocalTime {
  uint8_t hour;
  uint8_t minute;
};
bool getLocalTime2(LocalTime &out);

// Minutos que faltan hasta la próxima vez que sea startHour:startMinute
// (hoy si aún no ha pasado, mañana si ya pasó).
uint32_t minutesUntil(uint8_t startHour, uint8_t startMinute);

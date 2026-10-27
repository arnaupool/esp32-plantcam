#pragma once

// Copia este archivo como config.h (gitignored) y rellena tu secreto.
// WiFi y URL del backend se configuran por el portal cautivo la primera vez
// que arranca el dispositivo (ver docs/FIRMWARE.md); no van aquí.

// Debe coincidir con PROVISIONING_SECRET en el .env del backend.
#define PROVISIONING_SECRET "cambia-esto-por-el-mismo-secreto-del-backend"

// Sin DST automático: ajusta a mano si cambia el horario (ej. Madrid: 3600 en invierno, 7200 en verano)
#define TIMEZONE_OFFSET_SECONDS 3600

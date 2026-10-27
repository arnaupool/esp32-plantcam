#pragma once

#include "device_store.h"

// Portal cautivo (si no hay WiFi guardado) + auto-registro contra el backend
// (si no hay device_id/api_key en NVS). Bloquea hasta tener WiFi conectado.
// Devuelve false si el registro contra el backend falló (WiFi sí puede estar
// conectado en ese caso; se reintentará el registro en el próximo ciclo).
bool runProvisioning(DeviceStore &store);

// Mantener pulsado el botón BOOT (GPIO0) ~3s al arrancar borra WiFi + NVS y
// fuerza a pasar por el portal cautivo + registro de nuevo.
void checkFactoryResetButton();

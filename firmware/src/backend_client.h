#pragma once

#include <Arduino.h>

#include "device_store.h"

bool uploadPhoto(const uint8_t *jpeg, size_t len, const DeviceStore &store);

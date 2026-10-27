#pragma once

#include <esp_camera.h>

#include "device_store.h"

bool uploadPhoto(camera_fb_t *fb, const DeviceStore &store);

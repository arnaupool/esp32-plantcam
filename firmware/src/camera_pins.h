#pragma once

// Pinout del diseño de referencia ESP32-S3-WROOM-1-N16R8 CAM (mismo que usan
// Keyestudio MB0184 y la mayoría de clones de AliExpress con este chipset).
// Fuente: https://docs.keyestudio.com/projects/MB0184/en/latest/docs/MB0184%20ESP32-S3%20CAM%20Development%20Board.html
// Los clones a veces mueven algún pin: compara contra la serigrafía de tu
// placa antes de flashear si algo no responde.

#define CAM_PIN_PWDN    -1
#define CAM_PIN_RESET   -1
#define CAM_PIN_XCLK    15
#define CAM_PIN_SIOD    4
#define CAM_PIN_SIOC    5

#define CAM_PIN_D7      16
#define CAM_PIN_D6      17
#define CAM_PIN_D5      18
#define CAM_PIN_D4      12
#define CAM_PIN_D3      10
#define CAM_PIN_D2      8
#define CAM_PIN_D1      9
#define CAM_PIN_D0      11
#define CAM_PIN_VSYNC   6
#define CAM_PIN_HREF    7
#define CAM_PIN_PCLK    13

// SD_MMC en modo 1-bit (pines por defecto del core arduino-esp32 para S3)
#define SD_MMC_CLK      39
#define SD_MMC_CMD      38
#define SD_MMC_D0       40

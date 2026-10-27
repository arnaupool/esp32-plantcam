# Flashear el firmware del ESP32-S3

Necesitas: el servidor ya desplegado ([DEPLOY.md](DEPLOY.md)) con su `PROVISIONING_SECRET` a mano, el ESP32-S3 con la
cámara OV5640 montada, un cable USB de datos y Python 3 en el PC.

## 1. Preparar el entorno (una vez)

Si ya existe la carpeta `firmware/.venv` (este PC la tiene), salta este paso.

```bash
cd firmware
python -m venv .venv
.venv/Scripts/python -m pip install platformio
```

La primera compilación descarga el toolchain del ESP32-S3 (más de 1 GB, unos 10 minutos).

## 2. Configurar el secreto y la zona horaria

```bash
cp src/config.example.h src/config.h
```

Edita `src/config.h`:

- `PROVISIONING_SECRET`: el mismo valor que pusiste en el backend, carácter a carácter. Va compilado en el firmware: si
  lo cambias en el servidor, hay que reflashear.
- `TIMEZONE_OFFSET_SECONDS`: `3600` desde el último domingo de octubre hasta el último de marzo, `7200` el resto. El
  firmware no cambia solo de horario. Define a qué hora local empieza y acaba la ventana de fotos.

`config.h` no se sube a GitHub. WiFi y dirección del servidor no van aquí: se configuran en el primer arranque.

## 3. Comprobar los pines de la cámara

`src/camera_pins.h` usa el pinout del diseño de referencia ESP32-S3-WROOM-1 N16R8 CAM (el de Keyestudio MB0184 y la
mayoría de clones). Si tu placa lo cambia, el síntoma es `Fallo al iniciar la cámara` en el paso 6: corrige los pines
contra la serigrafía.

## 4. Conectar y compilar

Conecta el ESP32 por USB. Si la placa tiene dos puertos USB-C, usa el marcado como UART o COM. Comprueba que Windows lo
ve:

```bash
.venv/Scripts/python -m platformio device list
```

Debe aparecer un puerto COM. Si no aparece, instala el driver del chip USB-serie de la placa (CP210x o CH340, el
integrado junto al puerto) o prueba con el otro puerto USB-C.

## 5. Flashear

```bash
.venv/Scripts/python -m platformio run --target upload
```

Si falla con `Failed to connect` o `Wrong boot mode`: mantén pulsado **BOOT**, pulsa y suelta **RESET**, suelta BOOT y
repite el comando.

## 6. Ver el log

```bash
.venv/Scripts/python -m platformio device monitor
```

Pulsa **RESET** en la placa para ver el arranque desde el principio. Si no sale nada, prueba el otro puerto USB-C.

## 7. Primer arranque: configurar WiFi y servidor

1. En el móvil, conéctate a la red WiFi **`PlantCam-Setup`** (no tiene contraseña). Si no se abre sola una página,
   entra a `http://192.168.4.1`.
2. Pulsa **Configure WiFi**, elige tu red (tiene que ser de 2,4 GHz: el ESP32 no usa 5 GHz), escribe su contraseña y,
   en **URL del backend**:
   - Dentro de casa: `http://IP-UNRAID:8000`
   - Si el servidor está detrás de un dominio: `https://tu-dominio/api`
3. **Save**. El dispositivo se conecta a tu WiFi y se da de alta solo en el servidor. En el log verás
   `WiFi conectado: ...` y `Dispositivo auto-registrado: <id>`.

WiFi, URL y credenciales del dispositivo se guardan en la memoria del ESP32: en los siguientes arranques no vuelve a
pedir nada.

## 8. Ajustar desde el panel

En el panel web el dispositivo aparece como `PlantCam-XXXX` y pasa a "En línea" tras su primera foto. Entra en
**Ajustes** y configura nombre, modo de energía, intervalo, ventana horaria y resolución.

- Un dispositivo recién dado de alta queda en modo **enchufado**, con una foto cada 10 minutos entre las 07:00 y las
  21:00 y resolución UXGA. Para pilas, cámbialo a **batería** (duerme entre fotos).
- El dispositivo pide los ajustes antes de cada foto: un cambio se aplica en el siguiente ciclo (en modo batería, al
  siguiente despertar), no al instante.
- Al arrancar hace una foto enseguida si está dentro de la ventana horaria.

## Volver a configurar (cambio de WiFi o de servidor)

Mantén pulsado **BOOT** unos 3 segundos justo al encender o pulsar RESET: borra WiFi, servidor y alta, y vuelve al
paso 7. El dispositivo se registra como uno nuevo; el anterior queda en el panel sin actividad (todavía no hay botón
para borrar dispositivos).

## Problemas frecuentes

| Síntoma | Causa y solución |
|---------|------------------|
| `Fallo al iniciar la cámara` | Pines de `camera_pins.h` o cable flex de la cámara mal encajado |
| No aparece la red `PlantCam-Setup` | Ya tiene WiFi guardado: haz el reset de fábrica con BOOT |
| Pasan 5 minutos sin completar el portal | No reintenta solo: pulsa RESET y vuelve a empezar el paso 7 |
| `Fallo al auto-registrar ... HTTP 401` | `PROVISIONING_SECRET` distinto entre `config.h` y el servidor. Corrige uno y, si cambias el firmware, reflashea. Después RESET |
| `Fallo al auto-registrar ... HTTP 404` o error de conexión | URL del backend mal: puerto equivocado, o falta `/api` cuando va por dominio. Reset de fábrica y repite el paso 7 |
| Fotos fuera de horario o ventana desplazada una hora | `TIMEZONE_OFFSET_SECONDS` (cambio de horario) |
| No sube fotos pero el log muestra la captura | El servidor no es alcanzable desde ese WiFi: comprueba la URL del backend |

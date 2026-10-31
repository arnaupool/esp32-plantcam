# ESP32 PlantCam

ESP32-S3 con cámara que fotografía plantas a intervalos y un servidor propio que genera timelapses diarios y semanales.
Backend y panel web propios, pensado para uno o varios dispositivos.

Docs para personas: [README.md](README.md), [docs/DEPLOY.md](docs/DEPLOY.md) (servidor en Unraid),
[docs/FIRMWARE.md](docs/FIRMWARE.md) (flashear y dar de alta). Este archivo es el contexto para retomar el proyecto sin
leer todo el código: decisiones, secretos, endpoints y trampas.

## Estado

**Este proyecto no usa Obsidian ni Kanvas** (decisión del usuario, 28 de octubre de 2026): el seguimiento vive en la
sección "Pendiente" de este archivo. Si el usuario pide algo "para el futuro", se apunta ahí; si dice que se haga, se
empieza sin pedir aprobación en ningún tablero.

En marcha desde el 27 de octubre de 2026: servidor en el Unraid del usuario (`http://192.168.1.150:8000`, contenedor
`plantcam`) y una placa (`PlantCam-72E0`) cerca del router haciendo fotos. Probado con hardware real: portal cautivo,
alta, config, captura y subida. La subida falló con RSSI -70 dBm (escritorio del usuario) y funciona cerca del router.

## Pendiente

- **Flashear el firmware nuevo** en la placa (la que funciona lleva una versión anterior): espera de 3 s antes de
  disparar, resolución correcta en la primera foto, arreglo del horario y LED RGB apagado. Necesita que el usuario
  la traiga al PC. Mientras tanto, el horario lo hace cumplir el servidor (ver "Horario" en endpoints): con el
  firmware viejo la placa hizo fotos 24 horas al día del 27 al 30 de octubre de 2026.
- **Actualizar el contenedor en Unraid** tras cada push que toque `backend/` o `frontend/` (Edit y Apply). Después,
  en Ajustes de `PlantCam-72E0`, poner **Girar la imagen: 90° a la izquierda** (la cámara está montada de lado).
- Si con luz de día las fotos siguen con bandas o colores raros: ajustar el sensor (ganancia máxima, balance de
  blancos). Antes de tocarlo, comprobar con el firmware nuevo.
- Ofrecido y sin respuesta: resolución 1920x1080 (16:9) en el panel; reset de WiFi con BOOT que no borre el alta.
- DE-02 del plan original: publicar el panel tras el proxy del usuario (lo hace él, docs/DEPLOY.md).
- Deuda: borrar dispositivos desde el panel; pantalla de retención de fotos; zona horaria del firmware sin DST.

## Empaquetado y despliegue

- **Un solo contenedor** (decisión del usuario; antes eran backend y nginx separados, sin ninguna ventaja real): FastAPI
  sirve también el panel. Una imagen, un puerto (8000), una plantilla.
- Repo público `github.com/arnaupool/esp32-plantcam`. `.github/workflows/docker.yml` (no se ejecuta si solo cambian
  `docs/`, `unraid/`, `firmware/` o archivos `.md`):
  - job `check`: importa la app, construye la imagen, prueba el servidor (`/health` y `/api/health`, el panel en `/`,
    login, `POST /devices/register` por la raíz y por `/api`, ffmpeg dentro de la imagen) y comprueba que la imagen NO
    arranca sin secretos;
  - job `image` (solo si `check` pasa): publica `ghcr.io/arnaupool/plantcam` con tags `latest` y el sha del commit.
- Despliegue en Unraid sin Portainer (decisión del usuario, mismo patrón que su proyecto getaro): un contenedor desde el
  formulario Add Container, actualizar con Edit y Apply. Volumen host `/mnt/user/appdata/plantcam` montado en `/data`.
  Las migraciones de Alembic se aplican solas al arrancar el contenedor.
- Los paquetes de ghcr.io salen públicos (heredan la visibilidad del repo; se comprobó con una descarga anónima del
  manifest, HTTP 200). Si Unraid diera `unauthorized`, revisar Package settings en GitHub.
- `Dockerfile` en la raíz (copia `backend/` y `frontend/public/`). Trae por defecto `DATABASE_URL`, `PHOTOS_DIR`,
  `TIMELAPSES_DIR` (todo bajo `/data`), `FRONTEND_DIR=/app/static` y `REQUIRE_SECRETS=1`.
- `unraid/my-plantcam.xml` es la plantilla del formulario de Docker. Se copia a
  `/boot/config/plugins/dockerMan/templates-user/` del Unraid. Los secretos van vacíos y obligatorios porque el repo es
  público: nunca poner valores reales ahí.
- `docker-compose.yml` usa la imagen de ghcr.io; `docker-compose.build.yml` es un override para construir en local.
- Quedaron huérfanos los paquetes antiguos `plantcam-backend` y `plantcam-frontend` en ghcr.io (los dos contenedores
  de la primera versión). Se pueden borrar a mano desde GitHub.
- No hay Docker en el PC de desarrollo: la validación real del Dockerfile es la CI.
- Acceso de Claude al Unraid: alias SSH `anas-claude` (lectura libre, escrituras con confirmación). Útil para
  `docker logs plantcam` y para ver las fotos en `/mnt/user/appdata/plantcam/photos/`.

## Arquitectura

```
ESP32-S3 (firmware/) --HTTP--> FastAPI :8000 (API + panel) <-- navegador
                                    |
                           /data: SQLite, fotos, timelapses, cache/
```

- `backend/`: FastAPI, SQLAlchemy, SQLite, Alembic, APScheduler, Pillow. Elegido sin preguntar al usuario (encaja con
  Docker autocontenido). `app/main.py` registra cada router dos veces: en la raíz (`/devices`, lo que usa el firmware
  en la LAN) y bajo `/api` (`/api/devices`, lo que usa el panel y los dispositivos que entran por dominio; la copia
  `/api` no sale en `/docs`). El panel se monta al final en `/` con `StaticFiles` desde `FRONTEND_DIR` (por defecto
  `../frontend/public`), así que las rutas de la API tienen prioridad.
- `frontend/public/`: HTML y JS sin build, con rutas por `#hash`. `js/api.js` (peticiones y caché de imágenes),
  `js/ui.js` (formatos de fecha, escape de HTML, barra superior), `js/views/` (login, dashboard, página de dispositivo
  con pestañas fotos, timelapses y ajustes, y el visor a pantalla completa). Las imágenes se piden con `fetch` porque
  necesitan la cabecera de autenticación (un `<img src>` no la manda); no se pasa el token por la URL para que no
  acabe en los logs. Todo texto del servidor pasa por `esc()` antes de ir a `innerHTML`. Modo oscuro por
  `prefers-color-scheme`.
- `firmware/`: PlatformIO, framework Arduino, ESP32-S3 (16 MB de flash, 8 MB de PSRAM octal).

## Secretos y variables

| Variable | Qué hace | Notas |
|---|---|---|
| `SECRET_KEY` | Firma los JWT del panel | Mejor 64 hex (`openssl rand -hex 32`); con claves cortas PyJWT avisa |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | Único login del panel (sin gestión de usuarios) | |
| `PROVISIONING_SECRET` | Lo manda el firmware a `POST /devices/register` | **Debe coincidir con `firmware/src/config.h`**; va compilado, cambiarlo exige reflashear |
| `REQUIRE_SECRETS` | Si está activa, el backend no arranca si falta alguno de los cuatro | La imagen Docker la activa; en desarrollo no, y entonces valen los defaults inseguros (`admin`/`admin`, `dev-...`) |
| `DATABASE_URL`, `PHOTOS_DIR`, `TIMELAPSES_DIR` | Rutas | En local: `./data/...`; en la imagen: bajo `/data` |
| `IMAGE_CACHE_DIR` | Miniaturas y fotos giradas | Por defecto `cache/` junto a `PHOTOS_DIR`; se puede borrar, se regenera |

Con `PROVISIONING_SECRET` flojo o filtrado, cualquiera con acceso a la URL puede registrar dispositivos falsos.

## Backend: endpoints

- Panel (JWT, `POST /auth/login`): `POST/GET /devices`, `GET/PATCH /devices/{id}`,
  `GET /devices/{id}/photos[?start=&end=]` (o `?photo_date=`, día en UTC),
  `GET /devices/{id}/photos/{photo_id}/image[?size=thumb]`, `GET/POST /timelapses` (`?device_id=`),
  `GET /timelapses/{id}/video`, `DELETE /timelapses/{id}` (borra también el mp4),
  `DELETE /devices/{id}/photos/{photo_id}`, `POST /devices/{id}/photos/delete`.
  - `GET /devices` y `GET /devices/{id}` incluyen `last_photo_id` y `last_photo_at` (portada del dashboard).
  - `start`/`end` admiten zona horaria: el panel manda el día local del navegador y el backend lo pasa a UTC.
  - `image` devuelve la foto girada según `Device.rotation`; `size=thumb` da una miniatura de 480 px. Las variantes
    se generan con Pillow y se guardan en `IMAGE_CACHE_DIR` como `{photo_id}_{size}_{rotation}.jpg`. Al borrar una
    foto se borran también sus variantes (`services/images.py::remove_photo_files`), porque SQLite puede reutilizar ids.
- Alta de dispositivo (sin JWT, con `PROVISIONING_SECRET`): `POST /devices/register`. Crea el dispositivo activo con
  nombre `PlantCam-XXXX` y valores por defecto (enchufado, 600 s, 07:00 a 21:00, UXGA, sin girar).
- Dispositivo (cabecera `X-API-Key`): `GET /devices/{id}/config`, `POST /devices/{id}/photos` (multipart).
- **Horario**: `GET /devices/{id}/config` devuelve `is_active: false` fuera de la ventana horaria, calculada con la
  hora local del servidor (`services/schedule.py`). Así se cumple aunque el reloj de la placa falle, el firmware viejo
  lo respeta sin reflashear, y el cambio de hora lo resuelve el servidor. Depende de la variable `TZ` del contenedor:
  Unraid la pone sola (en el del usuario vale `Europe/Paris`); con Compose hay que ponerla.
- **Timelapses**: los días son días locales (convertidos a UTC al consultar) y solo entran las fotos dentro del
  horario del dispositivo, así que regenerar un día con fotos nocturnas antiguas da un vídeo limpio. Automáticos por
  dispositivo con `auto_daily_timelapse` y `auto_weekly_timelapse` (migración `b3d81f6a2c47`, ambos activados por
  defecto); el cron solo genera los de los dispositivos que los tienen activados.
- **Rotación** (`Device.rotation`: 0, 90, 180 o 270, grados en sentido horario; migración `7a1c2e9d4b10`): la aplica
  el servidor, nunca el firmware. La OV5640 solo sabe voltear (180°) y girar 90° en la placa exigiría recomprimir cada
  JPEG. Se aplica al servir imágenes y al generar timelapses (`transpose` de ffmpeg); el original no se toca. Los
  timelapses ya generados no cambian si luego se cambia la rotación.
- Cron interno (APScheduler, arranca en `startup`): timelapse diario 00:05, semanal domingo 00:15, purga a las 01:00.
- Retención por dispositivo (desde el 31/10/2026, migración `c5e2a9b7d013`): `Device.retention_days` (14 por defecto;
  `null` = no borrar nunca), en Ajustes como "Borrado automático de fotos" (1 semana a 1 año). La purga de la 01:00
  borra las fotos más antiguas que ese plazo. El timelapse semanal ya no borra fotos y la tabla `Settings` (fila id=1,
  `retention_days`, `delete_after_weekly_timelapse`) queda sin uso. Los vídeos nunca se borran solos.
- Borrar fotos a mano: `DELETE /devices/{id}/photos/{photo_id}` (204/404) y `POST /devices/{id}/photos/delete`
  `{"ids": [...]}` (devuelve `{"deleted": n}`, ignora ids de otro dispositivo). Borran original y caché. En el panel:
  Fotos, "Seleccionar" (con "Todas" para un día entero) o la papelera del visor; doble clic para confirmar
  (`confirmButton` de `ui.js`). `DeviceOut` trae `photo_count` y `photos_bytes` (se ven en Ajustes).
- Nombre de archivo de foto: `HHMMSSffffff_<nombre>` (con microsegundos desde el 31/10/2026). Antes era `HHMMSS_`, y
  dos subidas en el mismo segundo compartían archivo.
- Los timestamps de las fotos son UTC (`utcnow`) y son la hora de llegada al servidor, no la del disparo (segundos de
  diferencia). Los nombres de archivo también van en UTC.

## Firmware: decisiones y trampas

- **Pines de la cámara** (`camera_pins.h`): diseño de referencia ESP32-S3-WROOM-1 N16R8 CAM (Keyestudio MB0184 y la
  mayoría de clones). Verificados con la placa real.
- **Orden de un ciclo** (`runCycle`): primero pide la config y luego decide si captura (activo y dentro de horario).
  Antes la config se pedía después de la foto y en modo batería no se aplicaba.
- **La cámara se enciende en cada foto** ya con la resolución de la config (`initCamera(framesize)`), espera 3 s para
  que ajuste exposición y balance de blancos (`CAMERA_GRAB_LATEST`), dispara, copia el JPEG y se apaga
  (`esp_camera_deinit`) antes de subir. Motivo: encenderla a 5 MP y cambiar luego con `set_framesize` dejaba
  fotogramas viejos a 5 MP en el doble búfer, así que la primera foto tras arrancar salía a 2560x1920 aunque el driver
  dijera 1600x1200 (las siguientes sí salían bien). `fb->width/height` no sirven para comprobarlo: hay que leer la
  cabecera del JPEG. Sin la espera, las fotos salían oscuras o verdosas.
- **Hora (NTP)**: `getLocalTime2()` mira el reloj en cada consulta (`time() > 1700000000`). Antes usaba una bandera
  que solo se ponía si NTP respondía en los 10 s de `syncTime()`; si tardaba más, el horario quedaba ignorado para
  siempre y la placa hacía fotos toda la noche (pasó la noche del 27 al 28 de octubre de 2026).
- **Fail-open de horario**: sin hora todavía, `isWithinSchedule()` devuelve true (mejor fotos de más que ninguna).
  Da igual en la práctica: el servidor responde `is_active: false` fuera del horario y la placa no dispara.
- **WiFi**: tras conectar se desactiva el modo ahorro (`WiFi.setSleep(false)`); en el S3 viene activado por defecto
  (`WIFI_PS_MIN_MODEM`, en `WiFiGeneric.cpp`). La subida (`backend_client.cpp`) hace hasta 2 intentos, pero solo si la
  petición no llegó entera, para no duplicar fotos. Registra el RSSI y los milisegundos de cada intento.
- **Cobertura**: con RSSI -70 dBm las fotos de ~600 KB no llegaban (`HTTP -3` tras ~105 s, `Failed to send chunk!`),
  mientras que las peticiones pequeñas (alta, config) sí pasaban. Por eso un dispositivo puede salir "En línea" sin
  subir fotos. Cerca del router sube en segundos. Apagar la cámara durante la subida no cambió nada.
- **LED RGB** (WS2812, pin 48): conserva el último color mientras tenga corriente, incluso tras reiniciar; el firmware de
  fábrica lo dejaba encendido. Se apaga al arrancar. El LED rojo es el de alimentación y no se controla por software.
- **Modo batería**: el despertar del deep sleep reinicia el chip, así que `setup()` hace todo y termina en
  `esp_deep_sleep_start()`; nunca llega a `loop()`. Modo enchufado: `loop()` con `delay`.
- **Zona horaria**: `TIMEZONE_OFFSET_SECONDS` fijo en `config.h`, sin DST. 3600 de octubre a marzo, 7200 el resto.
- **Provisioning**: `config.h` solo lleva `PROVISIONING_SECRET` y la zona horaria. Primer arranque: AP abierto
  `PlantCam-Setup` (WiFiManager) con campos de WiFi y URL del backend, guardados en NVS (`Preferences`, espacio
  `plantcam`). Sin `device_id`/`api_key` en NVS, llama a `POST /devices/register` y los guarda. Reset de fábrica:
  mantener BOOT (GPIO0) 3 s al arrancar.
- **URL del backend que escribe el usuario**: `http://IP:8000` en la LAN, o `https://dominio` por dominio. El firmware
  le añade `/devices/...`, y el backend responde igual en la raíz que bajo `/api`, así que valen ambas formas.
- **Reintento**: `provisioning` solo se llama en `setup()`. En modo enchufado, si al acabar el intervalo no hay WiFi o
  no hay alta, `loop()` reinicia la placa para repetir portal y registro.
- **Flashear esta placa**: puerto USB-C del chip CH343 (`1A86:55D3`, salió como COM4). El otro USB-C es el USB nativo
  (`303A:4001`) y por él no sale el log. El paso automático a modo de grabación no funciona en esta placa: hay que
  mantener BOOT pulsado mientras arranca `platformio run --target upload`. Tras flashear, la WiFi y el alta guardadas
  en NVS se conservan.
- Compilación con PlatformIO en `firmware/.venv` (instalado por pip). `src/config.h` está en `.gitignore`.

## Cómo se prueba sin Docker

`uvicorn app.main:app --port 8150` dentro de `backend/` (con `alembic upgrade head` antes): ya sirve el panel en `/` y la
API, sin proxies. Entrar con `admin` / `admin` (en desarrollo no rige `REQUIRE_SECRETS`). Para timelapses reales hace
falta `ffmpeg` en el PATH (se instaló con winget en este PC). Para probar el panel con fotos de verdad, copiar algunas
del Unraid por SSH y subirlas con `curl` contra `/devices/{id}/photos` con la `X-API-Key` de un dispositivo local.

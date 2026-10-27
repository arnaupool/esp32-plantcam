# ESP32 PlantCam

ESP32-S3 con cámara que fotografía plantas a intervalos y un servidor propio que genera timelapses diarios y semanales.
Backend y panel web propios, pensado para uno o varios dispositivos.

Docs para personas: [README.md](README.md), [docs/DEPLOY.md](docs/DEPLOY.md) (servidor en Unraid),
[docs/FIRMWARE.md](docs/FIRMWARE.md) (flashear y dar de alta). Este archivo es el contexto para retomar el proyecto sin
leer todo el código: decisiones, secretos, endpoints y trampas.

## Estado

Seguimiento de tareas en `ESP32-PlantCam.canvas` (en `C:\Users\arnau\projects`, fuera de este repo; Kanvas). Se lee con
`python .tools-kanvas/canvas-tool.py "ESP32-PlantCam.canvas" status`; no se edita a mano (reglas en
`.tools-kanvas/CLAUDE.md`).

14 tareas hechas y verificadas, FI-05 (portal cautivo y auto-registro) en revisión, y pendientes DE-02 (publicar tras
el proxy del usuario, lo hace él con docs/DEPLOY.md) y DE-03 (prueba con el ESP32 real). **Nada del firmware se ha
probado con hardware**: solo compila. Backend y panel sí están probados de extremo a extremo en local (curl y navegador).

## Empaquetado y despliegue

- **Un solo contenedor** (decisión del usuario; antes eran backend y nginx separados, sin ninguna ventaja real): FastAPI
  sirve también el panel. Una imagen, un puerto (8000), una plantilla.
- Repo público `github.com/arnaupool/esp32-plantcam`. `.github/workflows/docker.yml` (no se ejecuta si solo cambian
  `docs/`, `unraid/` o archivos `.md`):
  - job `check`: importa la app, construye la imagen, prueba el servidor (`/health` y `/api/health`, el panel en `/`,
    login, `POST /devices/register` por la raíz y por `/api`, ffmpeg dentro de la imagen) y comprueba que la imagen NO
    arranca sin secretos;
  - job `image` (solo si `check` pasa): publica `ghcr.io/arnaupool/plantcam` con tags `latest` y el sha del commit.
- Despliegue en Unraid sin Portainer (decisión del usuario, mismo patrón que su proyecto getaro): un contenedor desde el
  formulario Add Container, actualizar con Edit y Apply. Volumen host `/mnt/user/appdata/plantcam` montado en `/data`.
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

## Arquitectura

```
ESP32-S3 (firmware/) --HTTP--> FastAPI :8000 (API + panel) <-- navegador
                                    |
                           /data: SQLite, fotos, timelapses
```

- `backend/`: FastAPI, SQLAlchemy, SQLite, Alembic, APScheduler. Elegido sin preguntar al usuario (encaja con Docker
  autocontenido). `app/main.py` registra cada router dos veces: en la raíz (`/devices`, lo que usa el firmware en la LAN)
  y bajo `/api` (`/api/devices`, lo que usa el panel y los dispositivos que entran por dominio; la copia `/api` no sale
  en `/docs`). El panel se monta al final en `/` con `StaticFiles` desde `FRONTEND_DIR` (por defecto
  `../frontend/public`), así que las rutas de la API tienen prioridad.
- `frontend/public/`: HTML y JS sin build, con rutas por `#hash` (no hace falta fallback de SPA). Llama siempre a
  `/api/...`. Elegido sin preguntar (panel pequeño y personal).
- `firmware/`: PlatformIO, framework Arduino, ESP32-S3 (16 MB de flash, 8 MB de PSRAM octal).

## Secretos y variables

| Variable | Qué hace | Notas |
|---|---|---|
| `SECRET_KEY` | Firma los JWT del panel | Mejor 64 hex (`openssl rand -hex 32`); con claves cortas PyJWT avisa |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | Único login del panel (sin gestión de usuarios) | |
| `PROVISIONING_SECRET` | Lo manda el firmware a `POST /devices/register` | **Debe coincidir con `firmware/src/config.h`**; va compilado, cambiarlo exige reflashear |
| `REQUIRE_SECRETS` | Si está activa, el backend no arranca si falta alguno de los cuatro | La imagen Docker la activa; en desarrollo no, y entonces valen los defaults inseguros (`admin`/`admin`, `dev-...`) |
| `DATABASE_URL`, `PHOTOS_DIR`, `TIMELAPSES_DIR` | Rutas | En local: `./data/...`; en la imagen: bajo `/data` |

Con `PROVISIONING_SECRET` flojo o filtrado, cualquiera con acceso a la URL puede registrar dispositivos falsos.

## Backend: endpoints

- Panel (JWT, `POST /auth/login`): `POST/GET /devices`, `GET/PATCH /devices/{id}`,
  `GET /devices/{id}/photos[?photo_date=]`, `GET /devices/{id}/photos/{photo_id}/image`, `GET/POST /timelapses`
  (`?device_id=`), `GET /timelapses/{id}/video`.
- Alta de dispositivo (sin JWT, con `PROVISIONING_SECRET`): `POST /devices/register`. Crea el dispositivo activo con
  nombre `PlantCam-XXXX` y valores por defecto (enchufado, 600 s, 07:00 a 21:00, UXGA).
- Dispositivo (cabecera `X-API-Key`): `GET /devices/{id}/config`, `POST /devices/{id}/photos` (multipart).
- Cron interno (APScheduler, arranca en `startup`): timelapse diario 00:05, semanal domingo 00:15, purga a las 01:00.
- Retención: `Settings.retention_days` (global, fila id=1, 14 por defecto) o `Device.retention_days`; con
  `Settings.delete_after_weekly_timelapse` (true por defecto) se borran las fotos de la semana al terminar el timelapse
  semanal. No hay pantalla para cambiar estos valores.
- Los timestamps de las fotos son UTC (`utcnow`).

## Firmware: decisiones y trampas

- **Pines de la cámara** (`camera_pins.h`): diseño de referencia ESP32-S3-WROOM-1 N16R8 CAM (Keyestudio MB0184 y la
  mayoría de clones). Es lo primero a revisar si la cámara no inicia.
- **Orden de un ciclo** (`runCycle`): primero pide la config, luego decide si captura (activo y dentro de horario), aplica
  la resolución si cambió y sube la foto. Antes la config se pedía después de la foto y en modo batería ni el horario ni
  la resolución se aplicaban (el chip se reinicia en cada ciclo).
- **Modo batería**: el despertar del deep sleep reinicia el chip, así que `setup()` hace todo y termina en
  `esp_deep_sleep_start()`; nunca llega a `loop()`. Modo enchufado: `loop()` con `delay`.
- **Zona horaria**: `TIMEZONE_OFFSET_SECONDS` fijo en `config.h`, sin DST. 3600 de octubre a marzo, 7200 el resto.
- **Fail-open de horario**: sin hora NTP, `isWithinSchedule()` devuelve true (mejor fotos de más que ninguna).
- **Provisioning (FI-05)**: `config.h` solo lleva `PROVISIONING_SECRET` y la zona horaria. Primer arranque: AP abierto
  `PlantCam-Setup` (WiFiManager) con campos de WiFi y URL del backend, guardados en NVS (`Preferences`, espacio
  `plantcam`). Sin `device_id`/`api_key` en NVS, llama a `POST /devices/register` y los guarda. Reset de fábrica:
  mantener BOOT (GPIO0) 3 s al arrancar.
- **URL del backend que escribe el usuario**: `http://IP:8000` en la LAN, o `https://dominio/api` por dominio. El
  firmware le añade `/devices/...`, y el backend responde igual en la raíz que bajo `/api`, así que valen ambas formas.
- **Sin reintento**: si el portal (timeout de 5 min) o el registro fallan, el dispositivo no vuelve a intentarlo hasta
  reiniciar. `provisioning` solo se llama en `setup()`.
- Compilación verificada con PlatformIO en `firmware/.venv` (instalado por pip). `src/config.h` está en `.gitignore`.

## Deuda conocida

Sin prueba con hardware; sin reintento de portal o registro; sin borrado de dispositivos ni UI de retención; zona horaria
sin DST; el AP de configuración no tiene contraseña.

## Cómo se prueba sin Docker

`uvicorn app.main:app --port 8150` dentro de `backend/` (con `alembic upgrade head` antes): ya sirve el panel en `/` y la
API, sin proxies. Entrar con `admin` / `admin` (en desarrollo no rige `REQUIRE_SECRETS`). Para timelapses reales hace
falta `ffmpeg` en el PATH (se instaló con winget en este PC).

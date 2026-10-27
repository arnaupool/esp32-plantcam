# Desplegar PlantCam en Unraid

La imagen se construye sola en GitHub en cada cambio y se publica en `ghcr.io/arnaupool/plantcam:latest`. Es un único
contenedor que sirve el panel web y la API. En Unraid se instala una vez desde el formulario de Docker y después se
actualiza con un clic. No hace falta terminal para usarlo, ni Portainer, ni plugins: solo Docker activado (Settings,
Docker, Enable Docker: Yes).

## Antes de empezar (5 minutos)

1. En GitHub, pestaña **Actions** del repo: el último "Imagen Docker" tiene que estar en verde (tarda unos 5 minutos
   tras cada push). Si es la primera vez, comprueba en tu perfil, **Packages**, que `plantcam` es **Public**; si sale
   privado, abre el paquete, Package settings, Change visibility.
2. Inventa cuatro valores y apúntalos:

   | Valor | Para qué | Cómo |
   |-------|----------|------|
   | `SECRET_KEY` | Firma las sesiones del panel | `openssl rand -hex 32` (en Git Bash) |
   | `ADMIN_USERNAME` | Tu usuario del panel | el que quieras |
   | `ADMIN_PASSWORD` | Tu contraseña del panel | larga |
   | `PROVISIONING_SECRET` | Permite que los ESP32 se den de alta solos | `openssl rand -hex 32` |

   `PROVISIONING_SECRET` hay que pegarlo también en el firmware ([FIRMWARE.md](FIRMWARE.md)), y los dos tienen que ser
   idénticos.

## Instalar con la plantilla (recomendado)

El repo trae una plantilla de Unraid en [`unraid/`](../unraid/) que rellena el formulario por ti.

1. Cópiala a la flash de Unraid (una vez), desde su terminal:

   ```bash
   cd /boot/config/plugins/dockerMan/templates-user
   curl -fsSLO https://raw.githubusercontent.com/arnaupool/esp32-plantcam/main/unraid/my-plantcam.xml
   ```

2. Pestaña **Docker**, **Add Container**, y en **Template** elige `my-plantcam` (sección User templates). Rellena las
   cuatro variables que salen vacías (los valores de "Antes de empezar") y **Apply**.
3. Abre `http://IP-UNRAID:8000/health`: tiene que responder `{"status":"ok"}`. El panel está en
   `http://IP-UNRAID:8000/` (o icono del contenedor, **WebUI**). Entra con `ADMIN_USERNAME` y `ADMIN_PASSWORD`. Empieza
   vacío: los dispositivos aparecen solos cuando se dan de alta ([FIRMWARE.md](FIRMWARE.md)).

La plantilla no trae ningún secreto: el repo es público, por eso salen vacíos. Si prefieres rellenar el formulario a
mano, sigue con la sección siguiente.

## Instalar a mano (sin plantilla)

1. Unraid, pestaña **Docker**, abajo **Add Container**.
2. Rellena:

   | Campo | Valor |
   |-------|-------|
   | Name | `plantcam` |
   | Repository | `ghcr.io/arnaupool/plantcam:latest` |
   | Network Type | `Bridge` |
   | WebUI | `http://[IP]:[PORT:8000]/` |

3. **Add another Path, Port, Variable, Label or Device** y añade estos seis (cambia "Config Type" en cada uno):

   | Config Type | Name | Valor |
   |-------------|------|-------|
   | Port | `Puerto` | Container Port `8000`, Host Port `8000` (o cualquier puerto libre) |
   | Path | `Datos` | Container Path `/data`, Host Path `/mnt/user/appdata/plantcam`, Read/Write |
   | Variable | `Secret key` | Key `SECRET_KEY`, Value: el de arriba |
   | Variable | `Usuario` | Key `ADMIN_USERNAME`, Value: el de arriba |
   | Variable | `Contraseña` | Key `ADMIN_PASSWORD`, Value: el de arriba |
   | Variable | `Secreto de alta` | Key `PROVISIONING_SECRET`, Value: el de arriba |

4. **Apply** y comprueba `http://IP-UNRAID:8000/health` como arriba.

Si el contenedor se para nada más arrancar, abre su icono, **Logs**: un mensaje `Faltan variables de entorno
obligatorias: ...` indica qué variable falta o está vacía. El servidor se niega a arrancar sin los cuatro secretos a
propósito, para que un olvido no deje el panel con una contraseña por defecto.

## Actualizar (cada vez que haya cambios)

Cuando se sube un cambio a GitHub, la imagen nueva está lista en unos 5 minutos. Entonces:

Pestaña Docker, icono de plantcam, **Edit** y **Apply** sin cambiar nada: Unraid descarga la imagen nueva y recrea el
contenedor. Otra forma: activa **Advanced View** (arriba a la derecha) y pulsa **force update** en su fila.

La base de datos se migra sola al arrancar. Los datos viven en `/mnt/user/appdata/plantcam` y no se tocan al
actualizar.

## Datos y copias de seguridad

Todo está en `/mnt/user/appdata/plantcam`: `db/plantcam.db` (dispositivos y ajustes), `photos/` y `timelapses/`. Para
una copia de seguridad basta con copiar esa carpeta.

Política de retención por defecto: las fotos originales se borran al generar el timelapse semanal (el domingo a las
00:15) y, en cualquier caso, a los 14 días. Los vídeos se conservan. Todavía no hay pantalla para cambiar esto.

## Acceso desde fuera de casa

1. En Nginx Proxy Manager (o tu túnel), un Proxy Host hacia `IP-UNRAID:8000`, con tu dominio y SSL. Sirve el panel y la
   API a la vez.
2. Un ESP32 que esté fuera de tu red usa como URL del servidor la misma dirección que abres en el navegador,
   `https://tu-dominio`. Dentro de casa usa `http://IP-UNRAID:8000`.
3. No abras el puerto 8000 en el router: todo lo de fuera debe entrar por el dominio, con SSL.

## Alternativa con Docker Compose

Si prefieres Compose: copia `.env.example` a `.env`, rellena los cuatro valores y ejecuta `docker compose up -d`. El
`docker-compose.yml` usa la misma imagen. Para construirla en local en lugar de descargarla:
`docker compose -f docker-compose.yml -f docker-compose.build.yml up -d --build`.

## Problemas frecuentes

| Síntoma | Causa y solución |
|---------|------------------|
| El contenedor se para al arrancar | Falta o está vacía alguna de las cuatro variables (mira Logs) |
| Al aplicar: `port is already allocated` | Edit, cambia el Host Port por otro libre |
| Al aplicar: `pull access denied` o `unauthorized` | El paquete de ghcr.io es privado: ponlo en Public (ver "Antes de empezar") |
| "Credenciales incorrectas" | No coincide con `ADMIN_USERNAME`/`ADMIN_PASSWORD`; si los cambias, Edit y Apply |
| Tras actualizar sigue la versión anterior | Mira que el último "Imagen Docker" de Actions esté en verde y repite Edit, Apply |
| Un ESP32 no se da de alta (401 en su log) | `PROVISIONING_SECRET` distinto entre el servidor y el firmware |

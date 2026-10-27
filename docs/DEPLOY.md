# Desplegar PlantCam en Unraid

Las imágenes se construyen solas en GitHub en cada cambio y se publican en
`ghcr.io/arnaupool/plantcam-backend:latest` y `ghcr.io/arnaupool/plantcam-frontend:latest`.
En Unraid se instalan una vez desde el formulario de Docker (son dos contenedores) y después se actualizan con un clic.
No hace falta terminal, Portainer ni plugins: solo Docker activado (Settings, Docker, Enable Docker: Yes).

## Antes de empezar (5 minutos)

1. En GitHub, pestaña **Actions** del repo: el último "Imágenes Docker" tiene que estar en verde (tarda unos 5 minutos
   tras cada push). Si es la primera vez, comprueba en tu perfil, **Packages**, que `plantcam-backend` y
   `plantcam-frontend` son **Public**; si salen privados, abre cada paquete, Package settings, Change visibility.
2. Inventa cuatro valores y apúntalos:

   | Valor | Para qué | Cómo |
   |-------|----------|------|
   | `SECRET_KEY` | Firma las sesiones del panel | `openssl rand -hex 32` (en Git Bash) |
   | `ADMIN_USERNAME` | Tu usuario del panel | el que quieras |
   | `ADMIN_PASSWORD` | Tu contraseña del panel | larga |
   | `PROVISIONING_SECRET` | Permite que los ESP32 se den de alta solos | `openssl rand -hex 32` |

   `PROVISIONING_SECRET` hay que pegarlo también en el firmware ([FIRMWARE.md](FIRMWARE.md)), y los dos tienen que ser
   idénticos.

## Instalar el backend (una vez)

1. Unraid, pestaña **Docker**, abajo **Add Container**.
2. Rellena:

   | Campo | Valor |
   |-------|-------|
   | Name | `plantcam-backend` |
   | Repository | `ghcr.io/arnaupool/plantcam-backend:latest` |
   | Network Type | `Bridge` |

3. **Add another Path, Port, Variable, Label or Device** y añade estos seis (cambia "Config Type" en cada uno):

   | Config Type | Name | Valor |
   |-------------|------|-------|
   | Path | `Datos` | Container Path `/data`, Host Path `/mnt/user/appdata/plantcam`, Read/Write |
   | Port | `API` | Container Port `8000`, Host Port `8000` (o cualquier puerto libre) |
   | Variable | `Secret key` | Key `SECRET_KEY`, Value: el de arriba |
   | Variable | `Usuario` | Key `ADMIN_USERNAME`, Value: el de arriba |
   | Variable | `Contraseña` | Key `ADMIN_PASSWORD`, Value: el de arriba |
   | Variable | `Secreto de alta` | Key `PROVISIONING_SECRET`, Value: el de arriba |

4. **Apply**. Para comprobarlo abre `http://IP-UNRAID:8000/health`: tiene que responder `{"status":"ok"}`.

Si el contenedor se para nada más arrancar, abre su icono, **Logs**: un mensaje `Faltan variables de entorno
obligatorias: ...` indica qué variable falta o está vacía. El backend se niega a arrancar sin los cuatro secretos a
propósito, para que un olvido no deje el panel con una contraseña por defecto.

## Instalar el panel web (una vez)

1. **Add Container** otra vez:

   | Campo | Valor |
   |-------|-------|
   | Name | `plantcam-web` |
   | Repository | `ghcr.io/arnaupool/plantcam-frontend:latest` |
   | Network Type | `Bridge` |
   | WebUI | `http://[IP]:[PORT:80]/` |

2. Añade dos:

   | Config Type | Name | Valor |
   |-------------|------|-------|
   | Port | `Panel` | Container Port `80`, Host Port `8080` (o cualquier puerto libre) |
   | Variable | `Backend` | Key `BACKEND_URL`, Value `http://IP-UNRAID:8000` (el Host Port que pusiste al backend) |

   `BACKEND_URL` tiene que ser la IP real del Unraid, no `localhost`: en el modo Bridge los contenedores no se ven por
   nombre.

3. **Apply**, icono del contenedor, **WebUI**. Entra con `ADMIN_USERNAME` y `ADMIN_PASSWORD`. El panel empieza vacío:
   los dispositivos aparecen solos cuando se dan de alta ([FIRMWARE.md](FIRMWARE.md)).

## Actualizar (cada vez que haya cambios)

Cuando se sube un cambio a GitHub, las imágenes nuevas están listas en unos 5 minutos. Entonces, para cada contenedor
(backend y web):

Pestaña Docker, icono del contenedor, **Edit** y **Apply** sin cambiar nada: Unraid descarga la imagen nueva y recrea el
contenedor. Otra forma: activa **Advanced View** (arriba a la derecha) y pulsa **force update** en su fila.

La base de datos se migra sola al arrancar el backend. Los datos viven en `/mnt/user/appdata/plantcam` y no se tocan al
actualizar.

## Datos y copias de seguridad

Todo está en `/mnt/user/appdata/plantcam`: `db/plantcam.db` (dispositivos y ajustes), `photos/` y `timelapses/`. Para
una copia de seguridad basta con copiar esa carpeta.

Política de retención por defecto: las fotos originales se borran al generar el timelapse semanal (el domingo a las
00:15) y, en cualquier caso, a los 14 días. Los vídeos se conservan. Todavía no hay pantalla para cambiar esto.

## Acceso desde fuera de casa

1. En Nginx Proxy Manager (o tu túnel), un Proxy Host hacia `IP-UNRAID:8080` (el panel), con tu dominio y SSL.
2. Un ESP32 que esté fuera de tu red usa como URL del backend `https://tu-dominio/api` (el panel reenvía `/api` al
   backend). Dentro de casa usa `http://IP-UNRAID:8000`.
3. No abras el puerto 8000 a internet: todo lo de fuera debe entrar por el dominio.

## Alternativa con Docker Compose

Si prefieres Compose: copia `.env.example` a `.env`, rellena los cuatro valores y ejecuta `docker compose up -d`. El
`docker-compose.yml` usa las mismas imágenes. Para construirlas en local en lugar de descargarlas:
`docker compose -f docker-compose.yml -f docker-compose.build.yml up -d --build`.

## Problemas frecuentes

| Síntoma | Causa y solución |
|---------|------------------|
| El backend se para al arrancar | Falta o está vacía alguna de las cuatro variables (mira Logs) |
| Al aplicar: `port is already allocated` | Edit, cambia el Host Port por otro libre |
| Al aplicar: `pull access denied` o `unauthorized` | El paquete de ghcr.io es privado: ponlo en Public (ver "Antes de empezar") |
| El panel carga pero da error al entrar | `BACKEND_URL` mal: tiene que apuntar a `http://IP-UNRAID:PUERTO-DEL-BACKEND` |
| "Credenciales incorrectas" | No coincide con `ADMIN_USERNAME`/`ADMIN_PASSWORD`; si los cambias, Edit y Apply en el backend |
| Tras actualizar sigue la versión anterior | Mira que el último "Imágenes Docker" de Actions esté en verde y repite Edit, Apply |
| Un ESP32 no se da de alta (401 en su log) | `PROVISIONING_SECRET` distinto entre el servidor y el firmware |

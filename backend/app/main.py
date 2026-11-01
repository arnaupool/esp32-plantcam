import os
from pathlib import Path

from fastapi import APIRouter, FastAPI
from fastapi.staticfiles import StaticFiles

from app.database import SessionLocal
from app.models.settings import Settings
from app.routers import auth, devices, timelapses
from app.scheduler import start_scheduler

# En la imagen Docker el panel está en /app/static; en local, en ../frontend/public.
FRONTEND_DIR = Path(os.environ.get("FRONTEND_DIR") or Path(__file__).resolve().parents[2] / "frontend" / "public")

app = FastAPI(title="ESP32 PlantCam")

health_router = APIRouter()


@health_router.get("/health")
def health():
    return {"status": "ok"}


# La API responde en la raíz (ESP32 en la LAN: http://IP:8000) y también bajo /api (el panel y
# los dispositivos que entran por un dominio). La copia de /api no sale en la documentación.
for router in (health_router, auth.router, devices.router, timelapses.router):
    app.include_router(router)
    app.include_router(router, prefix="/api", include_in_schema=False)


@app.on_event("startup")
def on_startup():
    db = SessionLocal()
    try:
        if db.get(Settings, 1) is None:
            db.add(Settings(id=1))
            db.commit()
    finally:
        db.close()
    start_scheduler()


class PanelFiles(StaticFiles):
    """Sin Cache-Control el navegador guardaba el JS viejo y tras actualizar el contenedor seguía el panel anterior.
    Con `no-cache` revalida cada archivo (ETag, 304 si no cambió), así que una actualización se ve al recargar."""

    async def get_response(self, path, scope):
        response = await super().get_response(path, scope)
        response.headers["Cache-Control"] = "no-cache"
        return response


# El panel va al final: las rutas de la API tienen prioridad sobre los archivos estáticos.
if FRONTEND_DIR.is_dir():
    app.mount("/", PanelFiles(directory=FRONTEND_DIR, html=True), name="panel")

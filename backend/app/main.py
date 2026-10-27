from fastapi import FastAPI

from app.database import SessionLocal
from app.models.settings import Settings
from app.routers import auth, devices, timelapses
from app.scheduler import start_scheduler

app = FastAPI(title="ESP32 PlantCam")

app.include_router(auth.router)
app.include_router(devices.router)
app.include_router(timelapses.router)


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


@app.get("/health")
def health():
    return {"status": "ok"}

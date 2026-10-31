import os
from datetime import date, datetime, time, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import PHOTOS_DIR, get_device_by_path_id_and_key
from app.models.device import Device
from app.models.photo import Photo
from app.schemas import (
    DeviceConfig,
    DeviceCreate,
    DeviceCreated,
    DeviceOut,
    DeviceRegister,
    DeviceUpdate,
    PhotoDelete,
    PhotoOut,
    PhotosDeleted,
    PhotoUploaded,
)
from app.security import get_current_user, verify_provisioning_secret
from app.services.images import image_variant, remove_photo_files
from app.services.schedule import within_schedule

router = APIRouter(prefix="/devices", tags=["devices"])


def _device_out(db: Session, device: Device) -> DeviceOut:
    out = DeviceOut.model_validate(device)
    last = db.query(Photo).filter(Photo.device_id == device.id).order_by(Photo.captured_at.desc()).first()
    if last is not None:
        out.last_photo_id = last.id
        out.last_photo_at = last.captured_at
    count, total = db.query(func.count(Photo.id), func.sum(Photo.file_size)).filter(Photo.device_id == device.id).one()
    out.photo_count = count
    out.photos_bytes = total or 0
    return out


def _as_utc_naive(value: datetime) -> datetime:
    """Las fechas se guardan en UTC sin zona; las que llegan del panel pueden traerla."""
    if value.tzinfo is None:
        return value
    return value.astimezone(timezone.utc).replace(tzinfo=None)


@router.post("", response_model=DeviceCreated, status_code=201)
def create_device(payload: DeviceCreate, db: Session = Depends(get_db), _user: str = Depends(get_current_user)):
    device = Device(**payload.model_dump())
    db.add(device)
    db.commit()
    db.refresh(device)
    return _device_out(db, device)


@router.post("/register", response_model=DeviceCreated, status_code=201)
def register_device(payload: DeviceRegister, db: Session = Depends(get_db)):
    if not verify_provisioning_secret(payload.provisioning_secret):
        raise HTTPException(status_code=401, detail="Invalid provisioning secret")
    device = Device(name=payload.name)
    db.add(device)
    db.commit()
    db.refresh(device)
    return device


@router.get("", response_model=list[DeviceOut])
def list_devices(db: Session = Depends(get_db), _user: str = Depends(get_current_user)):
    return [_device_out(db, device) for device in db.query(Device).order_by(Device.created_at).all()]


@router.get("/{device_id}", response_model=DeviceOut)
def get_device(device_id: str, db: Session = Depends(get_db), _user: str = Depends(get_current_user)):
    device = db.get(Device, device_id)
    if device is None:
        raise HTTPException(status_code=404, detail="Device not found")
    return _device_out(db, device)


@router.patch("/{device_id}", response_model=DeviceOut)
def update_device(
    device_id: str, payload: DeviceUpdate, db: Session = Depends(get_db), _user: str = Depends(get_current_user)
):
    device = db.get(Device, device_id)
    if device is None:
        raise HTTPException(status_code=404, detail="Device not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(device, field, value)

    db.commit()
    db.refresh(device)
    return _device_out(db, device)


@router.get("/{device_id}/photos", response_model=list[PhotoOut])
def list_photos(
    device_id: str,
    photo_date: date | None = None,
    start: datetime | None = None,
    end: datetime | None = None,
    db: Session = Depends(get_db),
    _user: str = Depends(get_current_user),
):
    """Filtra por `photo_date` (día en UTC) o por `start`/`end`; el panel manda su día local."""
    query = db.query(Photo).filter(Photo.device_id == device_id)
    if photo_date is not None:
        query = query.filter(
            Photo.captured_at >= datetime.combine(photo_date, time.min),
            Photo.captured_at <= datetime.combine(photo_date, time.max),
        )
    if start is not None:
        query = query.filter(Photo.captured_at >= _as_utc_naive(start))
    if end is not None:
        query = query.filter(Photo.captured_at < _as_utc_naive(end))
    return query.order_by(Photo.captured_at.desc()).all()


@router.get("/{device_id}/photos/{photo_id}/image")
def get_photo_image(
    device_id: str,
    photo_id: int,
    size: Literal["full", "thumb"] = "full",
    db: Session = Depends(get_db),
    _user: str = Depends(get_current_user),
):
    """La foto ya girada según el ajuste del dispositivo; `size=thumb` da una miniatura."""
    photo = db.get(Photo, photo_id)
    if photo is None or photo.device_id != device_id or not os.path.exists(photo.file_path):
        raise HTTPException(status_code=404, detail="Photo not found")
    device = db.get(Device, device_id)
    return FileResponse(image_variant(photo, device.rotation, size), media_type="image/jpeg")


def _delete_photos(db: Session, device_id: str, ids: list[int]) -> int:
    photos = db.query(Photo).filter(Photo.device_id == device_id, Photo.id.in_(ids)).all()
    for photo in photos:
        remove_photo_files(photo)
        db.delete(photo)
    db.commit()
    return len(photos)


@router.delete("/{device_id}/photos/{photo_id}", status_code=204)
def delete_photo(device_id: str, photo_id: int, db: Session = Depends(get_db), _user: str = Depends(get_current_user)):
    if _delete_photos(db, device_id, [photo_id]) == 0:
        raise HTTPException(status_code=404, detail="Photo not found")


@router.post("/{device_id}/photos/delete", response_model=PhotosDeleted)
def delete_photos(
    device_id: str, payload: PhotoDelete, db: Session = Depends(get_db), _user: str = Depends(get_current_user)
):
    """Borrado en bloque desde la galería (fotos seleccionadas o un día entero). Ignora ids de otro dispositivo."""
    return PhotosDeleted(deleted=_delete_photos(db, device_id, payload.ids))


@router.get("/{device_id}/config", response_model=DeviceConfig)
def get_device_config(device: Device = Depends(get_device_by_path_id_and_key), db: Session = Depends(get_db)):
    device.last_seen_at = datetime.utcnow()
    db.commit()
    # El servidor también decide si toca foto ahora: fuera del horario responde inactivo. Así el horario se
    # cumple aunque el reloj de la placa esté mal (el firmware anterior al 28 de octubre de 2026 lo ignoraba
    # si NTP tardaba en responder) y el horario sigue la hora local del servidor, cambio de hora incluido.
    config = DeviceConfig.model_validate(device)
    config.is_active = device.is_active and within_schedule(device.schedule_start, device.schedule_end)
    return config


@router.post("/{device_id}/photos", response_model=PhotoUploaded, status_code=201)
async def upload_photo(
    file: UploadFile,
    device: Device = Depends(get_device_by_path_id_and_key),
    db: Session = Depends(get_db),
):
    captured_at = datetime.utcnow()
    device_dir = os.path.join(PHOTOS_DIR, device.id, captured_at.strftime("%Y-%m-%d"))
    os.makedirs(device_dir, exist_ok=True)

    # Con microsegundos: dos subidas en el mismo segundo no comparten archivo (borrar una no se lleva la otra).
    filename = captured_at.strftime("%H%M%S%f") + "_" + os.path.basename(file.filename or "photo.jpg")
    file_path = os.path.join(device_dir, filename)

    contents = await file.read()
    with open(file_path, "wb") as f:
        f.write(contents)

    photo = Photo(
        device_id=device.id,
        captured_at=captured_at,
        file_path=file_path,
        file_size=len(contents),
    )
    device.last_seen_at = captured_at
    db.add(photo)
    db.commit()
    db.refresh(photo)
    return photo

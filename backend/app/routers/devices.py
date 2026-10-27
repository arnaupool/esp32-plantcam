import os
from datetime import date, datetime, time

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from fastapi.responses import FileResponse
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
    PhotoOut,
    PhotoUploaded,
)
from app.security import get_current_user, verify_provisioning_secret

router = APIRouter(prefix="/devices", tags=["devices"])


@router.post("", response_model=DeviceCreated, status_code=201)
def create_device(payload: DeviceCreate, db: Session = Depends(get_db), _user: str = Depends(get_current_user)):
    device = Device(**payload.model_dump())
    db.add(device)
    db.commit()
    db.refresh(device)
    return device


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
    return db.query(Device).order_by(Device.created_at).all()


@router.get("/{device_id}", response_model=DeviceOut)
def get_device(device_id: str, db: Session = Depends(get_db), _user: str = Depends(get_current_user)):
    device = db.get(Device, device_id)
    if device is None:
        raise HTTPException(status_code=404, detail="Device not found")
    return device


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
    return device


@router.get("/{device_id}/photos", response_model=list[PhotoOut])
def list_photos(
    device_id: str,
    photo_date: date | None = None,
    db: Session = Depends(get_db),
    _user: str = Depends(get_current_user),
):
    query = db.query(Photo).filter(Photo.device_id == device_id)
    if photo_date is not None:
        start = datetime.combine(photo_date, time.min)
        end = datetime.combine(photo_date, time.max)
        query = query.filter(Photo.captured_at >= start, Photo.captured_at <= end)
    return query.order_by(Photo.captured_at.desc()).all()


@router.get("/{device_id}/photos/{photo_id}/image")
def get_photo_image(
    device_id: str,
    photo_id: int,
    db: Session = Depends(get_db),
    _user: str = Depends(get_current_user),
):
    photo = db.get(Photo, photo_id)
    if photo is None or photo.device_id != device_id or not os.path.exists(photo.file_path):
        raise HTTPException(status_code=404, detail="Photo not found")
    return FileResponse(photo.file_path, media_type="image/jpeg")


@router.get("/{device_id}/config", response_model=DeviceConfig)
def get_device_config(device: Device = Depends(get_device_by_path_id_and_key), db: Session = Depends(get_db)):
    device.last_seen_at = datetime.utcnow()
    db.commit()
    return device


@router.post("/{device_id}/photos", response_model=PhotoUploaded, status_code=201)
async def upload_photo(
    file: UploadFile,
    device: Device = Depends(get_device_by_path_id_and_key),
    db: Session = Depends(get_db),
):
    captured_at = datetime.utcnow()
    device_dir = os.path.join(PHOTOS_DIR, device.id, captured_at.strftime("%Y-%m-%d"))
    os.makedirs(device_dir, exist_ok=True)

    filename = captured_at.strftime("%H%M%S") + "_" + file.filename
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

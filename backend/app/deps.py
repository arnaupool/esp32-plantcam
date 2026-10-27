import os

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.device import Device

PHOTOS_DIR = os.environ.get("PHOTOS_DIR", "./data/photos")


def get_device_by_path_id_and_key(
    device_id: str,
    x_api_key: str = Header(..., alias="X-API-Key"),
    db: Session = Depends(get_db),
) -> Device:
    device = db.get(Device, device_id)
    if device is None or device.api_key != x_api_key:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid device or API key")
    return device

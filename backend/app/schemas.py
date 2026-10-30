from datetime import date, datetime, time
from typing import Literal

from pydantic import BaseModel, Field

from app.models.device import PowerMode
from app.models.timelapse import TimelapseStatus, TimelapseType


class DeviceCreate(BaseModel):
    name: str
    power_mode: PowerMode = PowerMode.MAINS
    interval_seconds: int = Field(default=600, ge=10)
    schedule_start: time = time(7, 0)
    schedule_end: time = time(21, 0)
    resolution: str = "UXGA"


class DeviceRegister(BaseModel):
    provisioning_secret: str
    name: str = "Nuevo dispositivo"


class DeviceCreated(BaseModel):
    id: str
    name: str
    api_key: str

    class Config:
        from_attributes = True


class DeviceOut(BaseModel):
    id: str
    name: str
    power_mode: PowerMode
    interval_seconds: int
    schedule_start: time
    schedule_end: time
    resolution: str
    is_active: bool
    retention_days: int | None = None
    rotation: int = 0
    auto_daily_timelapse: bool = True
    auto_weekly_timelapse: bool = True
    last_seen_at: datetime | None = None
    last_photo_id: int | None = None
    last_photo_at: datetime | None = None

    class Config:
        from_attributes = True


class DeviceUpdate(BaseModel):
    name: str | None = None
    power_mode: PowerMode | None = None
    interval_seconds: int | None = Field(default=None, ge=10)
    schedule_start: time | None = None
    schedule_end: time | None = None
    resolution: str | None = None
    is_active: bool | None = None
    retention_days: int | None = Field(default=None, ge=1)
    rotation: Literal[0, 90, 180, 270] | None = None
    auto_daily_timelapse: bool | None = None
    auto_weekly_timelapse: bool | None = None


class DeviceConfig(BaseModel):
    power_mode: PowerMode
    interval_seconds: int
    schedule_start: time
    schedule_end: time
    resolution: str
    is_active: bool

    class Config:
        from_attributes = True


class PhotoUploaded(BaseModel):
    id: int
    captured_at: datetime
    file_size: int

    class Config:
        from_attributes = True


class PhotoOut(BaseModel):
    id: int
    captured_at: datetime
    file_size: int

    class Config:
        from_attributes = True


class TimelapseCreate(BaseModel):
    device_id: str
    date_from: date
    date_to: date
    fps: int = Field(default=24, ge=1, le=60)


class TimelapseOut(BaseModel):
    id: int
    device_id: str
    type: TimelapseType
    status: TimelapseStatus
    date_from: date
    date_to: date
    fps: int
    file_path: str | None
    created_at: datetime

    class Config:
        from_attributes = True

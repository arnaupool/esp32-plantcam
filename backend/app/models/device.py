import enum
import uuid
from datetime import datetime, time

from sqlalchemy import Boolean, DateTime, Enum, Integer, String, Time
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class PowerMode(str, enum.Enum):
    MAINS = "mains"
    BATTERY = "battery"


class Device(Base):
    __tablename__ = "devices"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(120))
    api_key: Mapped[str] = mapped_column(String(64), unique=True, index=True, default=lambda: uuid.uuid4().hex)

    power_mode: Mapped[PowerMode] = mapped_column(Enum(PowerMode), default=PowerMode.MAINS)
    interval_seconds: Mapped[int] = mapped_column(Integer, default=600)
    schedule_start: Mapped[time] = mapped_column(Time, default=time(7, 0))
    schedule_end: Mapped[time] = mapped_column(Time, default=time(21, 0))
    resolution: Mapped[str] = mapped_column(String(20), default="UXGA")
    # Grados (0, 90, 180, 270) que hay que girar la foto en sentido horario para verla derecha.
    # La aplica el servidor al mostrarla y en los timelapses; el original no se toca.
    rotation: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    # Timelapses automáticos del cron del servidor. El semanal además borra las fotos de esa semana al terminar.
    auto_daily_timelapse: Mapped[bool] = mapped_column(Boolean, default=True, server_default="1")
    auto_weekly_timelapse: Mapped[bool] = mapped_column(Boolean, default=True, server_default="1")

    retention_days: Mapped[int | None] = mapped_column(Integer, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    photos: Mapped[list["Photo"]] = relationship(back_populates="device", cascade="all, delete-orphan")
    timelapses: Mapped[list["Timelapse"]] = relationship(back_populates="device", cascade="all, delete-orphan")

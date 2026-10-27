import enum
from datetime import date, datetime

from sqlalchemy import Date, DateTime, Enum, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class TimelapseType(str, enum.Enum):
    DAILY = "daily"
    WEEKLY = "weekly"
    MANUAL = "manual"


class TimelapseStatus(str, enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    DONE = "done"
    FAILED = "failed"


class Timelapse(Base):
    __tablename__ = "timelapses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    device_id: Mapped[str] = mapped_column(ForeignKey("devices.id"), index=True)

    type: Mapped[TimelapseType] = mapped_column(Enum(TimelapseType))
    status: Mapped[TimelapseStatus] = mapped_column(Enum(TimelapseStatus), default=TimelapseStatus.PENDING)

    date_from: Mapped[date] = mapped_column(Date)
    date_to: Mapped[date] = mapped_column(Date)
    fps: Mapped[int] = mapped_column(Integer, default=24)

    file_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    device: Mapped["Device"] = relationship(back_populates="timelapses")

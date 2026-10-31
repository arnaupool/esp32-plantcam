from sqlalchemy import Boolean, Integer
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Settings(Base):
    """Singleton row (id=1). Sin uso desde el 31/10/2026: la retención va por dispositivo (Device.retention_days)."""

    __tablename__ = "settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    retention_days: Mapped[int] = mapped_column(Integer, default=14)
    delete_after_weekly_timelapse: Mapped[bool] = mapped_column(Boolean, default=True)

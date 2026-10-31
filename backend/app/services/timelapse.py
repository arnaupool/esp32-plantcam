import os
import shutil
import subprocess
import tempfile
from datetime import date, datetime, timedelta

from sqlalchemy.orm import Session

from app.models.device import Device
from app.models.photo import Photo
from app.models.timelapse import Timelapse, TimelapseStatus, TimelapseType
from app.services.images import remove_photo_files
from app.services.schedule import local_day_bounds_utc, utc_naive_to_local, within_schedule

TIMELAPSES_DIR = os.environ.get("TIMELAPSES_DIR", "./data/timelapses")

# Rotación del dispositivo (grados en sentido horario) -> filtro de ffmpeg.
_ROTATION_FILTERS = {90: "transpose=1", 180: "transpose=1,transpose=1", 270: "transpose=2"}


def _photos_in_range(db: Session, device: Device, date_from: date, date_to: date) -> list[Photo]:
    """Fotos de esos días locales que caen dentro del horario del dispositivo.

    Se descartan las de fuera de horario: así el vídeo sale limpio aunque haya fotos nocturnas guardadas
    (las hacía el firmware anterior al 28 de octubre de 2026 cuando ignoraba el horario)."""
    start, _ = local_day_bounds_utc(date_from)
    _, end = local_day_bounds_utc(date_to)
    photos = (
        db.query(Photo)
        .filter(Photo.device_id == device.id, Photo.captured_at >= start, Photo.captured_at < end)
        .order_by(Photo.captured_at)
        .all()
    )
    return [
        p
        for p in photos
        if within_schedule(device.schedule_start, device.schedule_end, utc_naive_to_local(p.captured_at))
    ]


def _run_ffmpeg(photos: list[Photo], output_path: str, fps: int, rotation: int = 0) -> bool:
    with tempfile.TemporaryDirectory() as tmp:
        for i, photo in enumerate(photos):
            if not os.path.exists(photo.file_path):
                continue
            shutil.copyfile(photo.file_path, os.path.join(tmp, f"frame_{i:06d}.jpg"))

        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        # libx264 con yuv420p exige ancho y alto pares.
        filters = [f for f in (_ROTATION_FILTERS.get(rotation), "scale=trunc(iw/2)*2:trunc(ih/2)*2") if f]
        cmd = [
            "ffmpeg", "-y",
            "-framerate", str(fps),
            "-i", os.path.join(tmp, "frame_%06d.jpg"),
            "-vf", ",".join(filters),
            "-c:v", "libx264",
            "-pix_fmt", "yuv420p",
            output_path,
        ]
        result = subprocess.run(cmd, capture_output=True, text=True)
        return result.returncode == 0


def generate_timelapse(
    db: Session,
    device_id: str,
    date_from: date,
    date_to: date,
    type_: TimelapseType,
    fps: int = 24,
) -> Timelapse:
    timelapse = Timelapse(
        device_id=device_id,
        type=type_,
        status=TimelapseStatus.PROCESSING,
        date_from=date_from,
        date_to=date_to,
        fps=fps,
    )
    db.add(timelapse)
    db.commit()
    db.refresh(timelapse)

    device = db.get(Device, device_id)
    photos = _photos_in_range(db, device, date_from, date_to) if device else []
    if not photos:
        timelapse.status = TimelapseStatus.FAILED
        db.commit()
        return timelapse

    output_path = os.path.join(
        TIMELAPSES_DIR, device_id, f"{type_.value}_{date_from.isoformat()}_{date_to.isoformat()}.mp4"
    )

    ok = _run_ffmpeg(photos, output_path, fps, device.rotation)
    timelapse.status = TimelapseStatus.DONE if ok else TimelapseStatus.FAILED
    timelapse.file_path = output_path if ok else None
    db.commit()

    return timelapse


def purge_expired_photos(db: Session) -> int:
    """Borra las fotos más antiguas que la retención de su dispositivo; sin retención no se borra nada."""
    deleted = 0
    for device in db.query(Device).filter(Device.retention_days.is_not(None)).all():
        cutoff = datetime.utcnow() - timedelta(days=device.retention_days)
        old_photos = db.query(Photo).filter(Photo.device_id == device.id, Photo.captured_at < cutoff).all()
        for photo in old_photos:
            remove_photo_files(photo)
            db.delete(photo)
            deleted += 1
    db.commit()
    return deleted

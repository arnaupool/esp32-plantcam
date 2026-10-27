import os

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.timelapse import Timelapse, TimelapseType
from app.schemas import TimelapseCreate, TimelapseOut
from app.security import get_current_user
from app.services.timelapse import generate_timelapse

router = APIRouter(prefix="/timelapses", tags=["timelapses"])


@router.get("", response_model=list[TimelapseOut])
def list_timelapses(
    device_id: str | None = None, db: Session = Depends(get_db), _user: str = Depends(get_current_user)
):
    query = db.query(Timelapse)
    if device_id is not None:
        query = query.filter(Timelapse.device_id == device_id)
    return query.order_by(Timelapse.created_at.desc()).all()


@router.post("", response_model=TimelapseOut, status_code=201)
def create_timelapse(payload: TimelapseCreate, db: Session = Depends(get_db), _user: str = Depends(get_current_user)):
    return generate_timelapse(
        db, payload.device_id, payload.date_from, payload.date_to, TimelapseType.MANUAL, payload.fps
    )


@router.get("/{timelapse_id}/video")
def get_timelapse_video(timelapse_id: int, db: Session = Depends(get_db), _user: str = Depends(get_current_user)):
    timelapse = db.get(Timelapse, timelapse_id)
    if timelapse is None or not timelapse.file_path or not os.path.exists(timelapse.file_path):
        raise HTTPException(status_code=404, detail="Video not found")
    return FileResponse(timelapse.file_path, media_type="video/mp4", filename=os.path.basename(timelapse.file_path))

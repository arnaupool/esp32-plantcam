from datetime import date, timedelta

from apscheduler.schedulers.background import BackgroundScheduler

from app.database import SessionLocal
from app.models.device import Device
from app.models.timelapse import TimelapseType
from app.services.timelapse import generate_timelapse, purge_expired_photos

scheduler = BackgroundScheduler()


def _run_daily_timelapses():
    yesterday = date.today() - timedelta(days=1)
    db = SessionLocal()
    try:
        devices = db.query(Device).filter(Device.is_active.is_(True), Device.auto_daily_timelapse.is_(True))
        for device in devices.all():
            generate_timelapse(db, device.id, yesterday, yesterday, TimelapseType.DAILY)
    finally:
        db.close()


def _run_weekly_timelapses():
    today = date.today()
    week_start = today - timedelta(days=7)
    db = SessionLocal()
    try:
        devices = db.query(Device).filter(Device.is_active.is_(True), Device.auto_weekly_timelapse.is_(True))
        for device in devices.all():
            generate_timelapse(db, device.id, week_start, today - timedelta(days=1), TimelapseType.WEEKLY)
    finally:
        db.close()


def _run_retention_purge():
    db = SessionLocal()
    try:
        purge_expired_photos(db)
    finally:
        db.close()


def start_scheduler():
    scheduler.add_job(_run_daily_timelapses, "cron", hour=0, minute=5, id="daily_timelapse", replace_existing=True)
    scheduler.add_job(_run_weekly_timelapses, "cron", day_of_week="sun", hour=0, minute=15, id="weekly_timelapse", replace_existing=True)
    scheduler.add_job(_run_retention_purge, "cron", hour=1, minute=0, id="retention_purge", replace_existing=True)
    scheduler.start()

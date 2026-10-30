from datetime import date, datetime, time, timedelta, timezone

# Todo lo de este módulo usa la hora local del servidor: la zona horaria del contenedor (variable TZ; Unraid la pone
# sola). Las fotos se guardan en UTC sin zona, así que hay que convertir al comparar con días u horarios locales.


def within_schedule(start: time, end: time, at: datetime | None = None) -> bool:
    """¿Cae `at` (hora local; por defecto, ahora) dentro de [start, end)? Admite ventanas que cruzan la medianoche."""
    current = (at or datetime.now()).time()
    if start <= end:
        return start <= current < end
    return current >= start or current < end


def utc_naive_to_local(value: datetime) -> datetime:
    return value.replace(tzinfo=timezone.utc).astimezone().replace(tzinfo=None)


def local_day_bounds_utc(day: date) -> tuple[datetime, datetime]:
    """Inicio y fin (exclusivo) de un día local, en UTC sin zona, como se guardan las fotos."""

    def to_utc(local_midnight: datetime) -> datetime:
        return local_midnight.astimezone(timezone.utc).replace(tzinfo=None)

    return to_utc(datetime.combine(day, time.min)), to_utc(datetime.combine(day + timedelta(days=1), time.min))

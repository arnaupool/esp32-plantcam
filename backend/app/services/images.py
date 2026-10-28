import glob
import os
import threading

from PIL import Image

from app.deps import PHOTOS_DIR
from app.models.photo import Photo

# Variantes generadas (miniaturas y fotos giradas). Se pueden borrar sin perder nada: se regeneran.
CACHE_DIR = os.environ.get("IMAGE_CACHE_DIR") or os.path.join(
    os.path.dirname(os.path.abspath(PHOTOS_DIR)), "cache"
)
THUMB_SIZE = 480

# Grados en sentido horario -> transposición de Pillow (ROTATE_* gira en sentido antihorario).
_TRANSPOSE = {
    90: Image.Transpose.ROTATE_270,
    180: Image.Transpose.ROTATE_180,
    270: Image.Transpose.ROTATE_90,
}


def image_variant(photo: Photo, rotation: int, size: str) -> str:
    """Ruta del JPEG a servir: el original si no hay que tocarlo, o una variante cacheada."""
    if size == "full" and rotation == 0:
        return photo.file_path

    path = os.path.join(CACHE_DIR, f"{photo.id}_{size}_{rotation}.jpg")
    if os.path.exists(path):
        return path

    os.makedirs(CACHE_DIR, exist_ok=True)
    with Image.open(photo.file_path) as original:
        img = original.transpose(_TRANSPOSE[rotation]) if rotation in _TRANSPOSE else original.copy()
    if size == "thumb":
        img.thumbnail((THUMB_SIZE, THUMB_SIZE))

    # Se escribe aparte y se renombra: dos peticiones a la vez nunca ven un archivo a medias.
    tmp = f"{path}.{os.getpid()}.{threading.get_ident()}.tmp"
    img.save(tmp, "JPEG", quality=82 if size == "thumb" else 92)
    os.replace(tmp, path)
    return path


def remove_photo_files(photo: Photo) -> None:
    """Borra el original y sus variantes cacheadas (los ids de SQLite se pueden reutilizar)."""
    if os.path.exists(photo.file_path):
        os.remove(photo.file_path)
    for cached in glob.glob(os.path.join(CACHE_DIR, f"{photo.id}_*.jpg")):
        os.remove(cached)

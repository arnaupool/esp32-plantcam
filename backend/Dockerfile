FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Datos dentro del volumen /data; sin los secretos el contenedor no arranca.
ENV DATABASE_URL=sqlite:////data/db/plantcam.db \
    PHOTOS_DIR=/data/photos \
    TIMELAPSES_DIR=/data/timelapses \
    REQUIRE_SECRETS=1

EXPOSE 8000

CMD ["sh", "-c", "mkdir -p /data/db /data/photos /data/timelapses && alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000"]

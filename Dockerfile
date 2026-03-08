# ====================================================
# Backend Dockerfile
# torch устанавливается отдельно (CPU-only) для меньшего размера образа
# ====================================================

FROM python:3.11-slim

# Системные зависимости: ffmpeg для аудио, gcc для Cython-пакетов
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Устанавливаем CPU-only torch отдельно (значительно меньше GPU-версии)
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu

# Устанавливаем остальные зависимости
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Копируем код приложения
COPY app/ ./app/

# Директория для БД и загруженных файлов
RUN mkdir -p /app/data /app/uploads

# Запускаем от непривилегированного пользователя (security best practice)
RUN useradd -m -u 1001 appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

# workers=1 для SQLite (не поддерживает concurrent writes)
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]

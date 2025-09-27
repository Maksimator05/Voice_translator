import os
import uuid
import aiofiles
import tempfile
import shutil
from fastapi import UploadFile, HTTPException
import logging
from pathlib import Path

logger = logging.getLogger(__name__)


class FileService:

    @staticmethod
    def generate_transcription_id() -> str:
        return f"trans_{uuid.uuid4().hex[:8]}"

    @staticmethod
    def validate_voice_file(file: UploadFile) -> None:
        """Либеральная валидация - разрешаем почти все форматы"""
        allowed_types = [
            'audio/', 'video/', 'application/octet-stream'
        ]

        if not any(file.content_type.startswith(t) for t in allowed_types):
            logger.warning(f"Нестандартный тип файла: {file.content_type}")
        # Не блокируем, а только предупреждаем

    @staticmethod
    async def save_and_convert_file(file: UploadFile, file_id: str) -> str:
        """
        Сохраняет файл и при необходимости конвертирует в WAV
        Возвращает путь к файлу, гарантированно поддерживаемому Whisper
        """
        os.makedirs("uploads", exist_ok=True)

        # Сохраняем оригинальный файл
        original_ext = Path(file.filename).suffix.lower()
        original_path = os.path.join("uploads", f"{file_id}_original{original_ext}")

        try:
            # Сохраняем оригинальный файл
            async with aiofiles.open(original_path, 'wb') as buffer:
                content = await file.read()
                await buffer.write(content)

            logger.info(f"💾 Оригинальный файл сохранен: {original_path}")

            # Проверяем, нужно ли конвертировать
            wav_path = await FileService._convert_to_wav_if_needed(original_path, file_id)

            return wav_path

        except Exception as e:
            logger.error(f"❌ Ошибка сохранения файла: {e}")
            # Пробуем fallback - сохраняем как есть
            fallback_path = os.path.join("uploads", f"{file_id}.wav")
            shutil.copy2(original_path, fallback_path)
            return fallback_path

    @staticmethod
    async def _convert_to_wav_if_needed(original_path: str, file_id: str) -> str:
        """Конвертирует файл в WAV если это необходимо"""
        wav_path = os.path.join("uploads", f"{file_id}.wav")

        # Если файл уже WAV, возвращаем как есть
        if original_path.lower().endswith('.wav'):
            logger.info("✅ Файл уже в формате WAV")
            return original_path

        # Пробуем конвертацию с pydub
        try:
            from pydub import AudioSegment
            logger.info(f"🔄 Конвертация {Path(original_path).suffix} -> WAV")

            # Определяем формат по расширению
            ext = Path(original_path).suffix.lower().lstrip('.')
            if ext in ['mp3', 'm4a', 'ogg', 'flac', 'wma']:
                audio = AudioSegment.from_file(original_path, format=ext)
                audio.export(wav_path, format="wav")
                logger.info(f"✅ Успешная конвертация в WAV")
                return wav_path
            else:
                # Для неизвестных форматов пробуем автоопределение
                audio = AudioSegment.from_file(original_path)
                audio.export(wav_path, format="wav")
                logger.info(f"✅ Конвертация автоопределением в WAV")
                return wav_path

        except ImportError:
            logger.warning("⚠️ pydub не установлен, используем оригинальный файл")
            return original_path
        except Exception as e:
            logger.warning(f"⚠️ Ошибка конвертации: {e}, используем оригинальный файл")
            return original_path

    @staticmethod
    async def save_temporary_file(file: UploadFile, file_id: str) -> str:
        """Основной метод сохранения файла"""
        return await FileService.save_and_convert_file(file, file_id)

    @staticmethod
    def cleanup_temp_file(file_path: str) -> bool:
        """Очистка временных файлов"""
        try:
            uploads_dir = "uploads"
            if os.path.exists(file_path):
                os.remove(file_path)
                logger.info(f"🗑️ Удален: {file_path}")

            # Удаляем все временные файлы с этим ID
            for file in os.listdir(uploads_dir):
                if file.startswith(Path(file_path).stem):
                    full_path = os.path.join(uploads_dir, file)
                    if os.path.exists(full_path):
                        os.remove(full_path)
                        logger.info(f"🗑️ Удален временный файл: {file}")

            return True
        except Exception as e:
            logger.warning(f"⚠️ Ошибка очистки: {e}")
            return False

    @staticmethod
    def sanitize_filename(filename: str) -> str:
        """Очищает имя файла от специальных символов"""
        # Заменяем проблемные символы
        invalid_chars = '<>:"/\\|?*'
        for char in invalid_chars:
            filename = filename.replace(char, '_')
        return filename
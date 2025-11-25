import os
import uuid
import subprocess
import logging
from pathlib import Path
from typing import List

logger = logging.getLogger(__name__)


class AudioProcessor:
    """Универсальный процессор для работы с аудио"""

    def __init__(self):
        self.temp_dirs = ["temp_audio", "converted_audio"]
        for dir_name in self.temp_dirs:
            os.makedirs(dir_name, exist_ok=True)
        logger.info("✅ AudioProcessor инициализирован")

    async def convert_audio_to_wav(self, input_path: str) -> str:
        """
        Конвертирует любой аудиоформат в WAV
        Возвращает путь к WAV файлу
        """
        try:
            # Генерируем уникальное имя для выходного файла
            file_id = str(uuid.uuid4())[:8]
            output_path = os.path.join("converted_audio", f"converted_{file_id}.wav")

            # Команда ffmpeg для конвертации в WAV
            cmd = [
                'ffmpeg',
                '-i', input_path,  # Входной файл
                '-acodec', 'pcm_s16le',  # Кодек PCM 16-bit
                '-ac', '1',  # Моно
                '-ar', '16000',  # Частота 16kHz
                '-y',  # Перезаписать если существует
                output_path  # Выходной файл
            ]

            logger.info(f"🔄 Конвертация {input_path} -> {output_path}")

            # Запускаем конвертацию
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=60  # 60 секунд таймаут
            )

            if result.returncode == 0:
                # Проверяем что файл создан и не пустой
                if os.path.exists(output_path) and os.path.getsize(output_path) > 0:
                    logger.info(f"✅ Успешно сконвертировано: {output_path}")
                    return output_path
                else:
                    raise Exception("Выходной файл не создан или пустой")
            else:
                error_msg = result.stderr.strip() if result.stderr else "Unknown error"
                raise Exception(f"FFmpeg error: {error_msg}")

        except subprocess.TimeoutExpired:
            raise Exception("Таймаут конвертации (60 секунд)")
        except FileNotFoundError:
            raise Exception("FFmpeg не установлен. Установите ffmpeg и добавьте в PATH")
        except Exception as e:
            raise Exception(f"Ошибка конвертации: {str(e)}")

    async def save_uploaded_file(self, audio_file) -> str:
        """Сохраняет загруженный файл и возвращает путь"""
        try:
            # Создаем уникальное имя файла
            file_id = str(uuid.uuid4())[:8]
            original_ext = Path(audio_file.filename).suffix or ".audio"
            file_path = os.path.join("temp_audio", f"upload_{file_id}{original_ext}")

            # Сохраняем файл
            content = await audio_file.read()
            with open(file_path, "wb") as f:
                f.write(content)

            logger.info(f"📁 Файл сохранен: {file_path}")
            return file_path

        except Exception as e:
            raise Exception(f"Ошибка сохранения файла: {str(e)}")

    def cleanup_files(self, file_paths: List[str]):
        """Очистка временных файлов"""
        for file_path in file_paths:
            if file_path and os.path.exists(file_path):
                try:
                    os.remove(file_path)
                    logger.info(f"🗑️ Удален: {file_path}")
                except Exception as e:
                    logger.warning(f"⚠️ Не удалось удалить {file_path}: {e}")

    async def process_audio_file(self, audio_file, llm_processor) -> str:
        """
        Полная обработка аудиофайла: сохранение -> конвертация -> транскрипция
        Возвращает транскрипцию или сообщение об ошибке
        """
        temp_files = []

        try:
            # 1. Сохраняем оригинальный файл
            original_path = await self.save_uploaded_file(audio_file)
            temp_files.append(original_path)

            # 2. Конвертируем в WAV
            wav_path = await self.convert_audio_to_wav(original_path)
            temp_files.append(wav_path)

            # 3. Транскрибируем
            transcription_result = await llm_processor.transcribe_audio(wav_path)

            if transcription_result and transcription_result.get("success"):
                audio_transcription = transcription_result.get("text", "").strip()
                if audio_transcription:
                    logger.info(f"✅ Аудио транскрибировано: {len(audio_transcription)} символов")
                    return audio_transcription
                else:
                    return "[Транскрипция пустая]"
            else:
                error_msg = transcription_result.get('text', 'Unknown error') if transcription_result else 'No result'
                logger.error(f"❌ Ошибка транскрипции: {error_msg}")
                return "[Транскрипция не удалась]"

        except Exception as e:
            logger.error(f"❌ Ошибка обработки аудио: {e}")
            return f"[Ошибка: {str(e)}]"
        finally:
            # Всегда очищаем временные файлы
            self.cleanup_files(temp_files)


# Синглтон для использования
audio_processor = AudioProcessor()
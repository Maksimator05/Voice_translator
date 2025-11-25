import logging
from typing import Dict, Any, List, Optional
logger = logging.getLogger(__name__)


class MeetingAnalyzer:
    """Основной класс для анализа встреч"""

    def __init__(self, config: Optional[Dict] = None):
        from .speaker_diarization import SimpleDiarizationService
        from .content_processor import ContentProcessor

        self.config = config or {}
        self.diarization_service = SimpleDiarizationService(config)
        self.content_processor = ContentProcessor(config)

        # Переменные для хранения состояния анализа
        self.audio_filename: Optional[str] = None
        self.audio_transcription: Optional[str] = None
        self.audio_analysis: Optional[Dict[str, Any]] = None
        self.segments: List[Dict] = []

        logger.info("✅ MeetingAnalyzer инициализирован")

    async def initialize(self) -> bool:
        """Инициализация всех компонентов"""
        try:
            # Инициализируем контент процессор
            content_ready = await self.content_processor.initialize()

            if content_ready:
                logger.info("✅ Все компоненты MeetingAnalyzer готовы к работе")
                return True
            else:
                logger.warning("⚠️ Некоторые компоненты не инициализированы, но работа продолжится")
                return True  # Все равно возвращаем True для продолжения работы

        except Exception as e:
            logger.error(f"❌ Ошибка инициализации MeetingAnalyzer: {e}")
            return False

    async def analyze_meeting(self, audio_filename: str) -> Dict[str, Any]:
        """
        Полный анализ встречи от аудио до результатов
        """
        try:
            # Сохраняем имя файла
            self.audio_filename = audio_filename

            logger.info(f"🎵 Начинаем анализ аудио: {audio_filename}")

            # 1. Диаризация и транскрипция
            self.segments = self.diarization_service.diarize_audio(audio_filename)

            # 2. Получаем транскрипцию
            self.audio_transcription = self._extract_transcription(self.segments)

            # 3. Анализ содержания
            self.audio_analysis = await self.content_processor.process_meeting_content(
                transcription=self.audio_transcription,
                duration=self._calculate_duration(self.segments),
                speakers=self._extract_speakers(self.segments),
                segments=self.segments
            )

            logger.info("✅ Анализ встречи завершен")

            return self._create_success_response()

        except Exception as e:
            logger.error(f"❌ Ошибка анализа встречи: {e}")
            return self._create_error_response(str(e))

    async def transcribe_only(self, audio_filename: str) -> Dict[str, Any]:
        """
        Только транскрипция без полного анализа
        """
        try:
            self.audio_filename = audio_filename

            # Используем LLMProcessor для транскрипции
            transcription_result = await self.content_processor.transcribe_audio(audio_filename)

            if transcription_result.get("success"):
                self.audio_transcription = transcription_result.get("text", "")
                self.segments = transcription_result.get("segments", [])

                return {
                    "success": True,
                    "audio_filename": self.audio_filename,
                    "transcription": self.audio_transcription,
                    "segments": self.segments,
                    "language": transcription_result.get("language", "ru"),
                    "duration": transcription_result.get("duration", 0)
                }
            else:
                return {
                    "success": False,
                    "error": transcription_result.get("text", "Ошибка транскрипции"),
                    "audio_filename": self.audio_filename
                }

        except Exception as e:
            logger.error(f"❌ Ошибка транскрипции: {e}")
            return {
                "success": False,
                "error": str(e),
                "audio_filename": self.audio_filename
            }

    def get_analysis_status(self) -> Dict[str, Any]:
        """Возвращает текущий статус анализа"""
        return {
            "audio_filename": self.audio_filename,
            "has_transcription": self.audio_transcription is not None and self.audio_transcription != "",
            "has_analysis": self.audio_analysis is not None,
            "segments_count": len(self.segments),
            "transcription_length": len(self.audio_transcription) if self.audio_transcription else 0,
            "llm_available": self.content_processor.llm_processor.is_connected,
            "whisper_available": self.content_processor.llm_processor.whisper_initialized
        }

    def _extract_transcription(self, segments: List[Dict]) -> str:
        """Извлекает полный текст транскрипции из сегментов"""
        if not segments:
            return ""

        transcription = " ".join([segment.get('text', '') for segment in segments if segment.get('text')])
        logger.info(f"📝 Извлечена транскрипция: {len(transcription)} символов")
        return transcription

    def _calculate_duration(self, segments: List[Dict]) -> float:
        """Вычисляет общую длительность встречи"""
        if not segments:
            return 0.0

        duration = max(segment.get('end', 0) for segment in segments)
        logger.info(f"⏱️ Длительность встречи: {duration} секунд")
        return duration

    def _extract_speakers(self, segments: List[Dict]) -> Dict[str, int]:
        """Извлекает информацию о спикерах"""
        speakers = {}
        for segment in segments:
            speaker = segment.get('speaker', 'UNKNOWN')
            speakers[speaker] = speakers.get(speaker, 0) + 1

        logger.info(f"👥 Обнаружено спикеров: {len(speakers)}")
        return speakers

    def _create_success_response(self) -> Dict[str, Any]:
        """Создает успешный ответ"""
        return {
            "success": True,
            "audio_filename": self.audio_filename,
            "audio_transcription": self.audio_transcription,
            "audio_analysis": self.audio_analysis,
            "segments": self.segments,
            "segments_count": len(self.segments),
            "status": "completed"
        }

    def _create_error_response(self, error_message: str) -> Dict[str, Any]:
        """Создает ответ с ошибкой"""
        return {
            "success": False,
            "audio_filename": self.audio_filename,
            "audio_transcription": self.audio_transcription,
            "audio_analysis": self.audio_analysis,
            "segments": self.segments,
            "status": "error",
            "error": error_message
        }

class ContentProcessor:
    """Процессор для анализа содержания встреч"""

    def __init__(self):
        logger.info("✅ ContentProcessor инициализирован")

    async def process_meeting_content(self) -> Dict[str, Any]:
        """
        Обработка содержания встречи
        """
        try:
            # Здесь будет интеграция с LLM для анализа
            # Пока возвращаем заглушку

            return {
                "summary": "Обсуждение проекта разработки программного обеспечения",
                "key_points": [
                    "Завершение модуля авторизации",
                    "Интеграция с платежной системой",
                    "Постановка задач на неделю"
                ],
                "tasks": [
                    {
                        "description": "Завершить тесты модуля авторизации",
                        "assigned_to": "Разработчик 2",
                        "context": "Модуль почти готов, осталось тестирование"
                    }
                ],
                "decisions": [
                    {
                        "description": "Утвердить план разработки на неделю",
                        "participants": ["Все участники"],
                        "context": "Общее согласование сроков"
                    }
                ],
                "water_content": 0.2
            }

        except Exception as e:
            logger.error(f"❌ Ошибка обработки содержания: {e}")
            return self._create_fallback_analysis()

    def _create_fallback_analysis(self) -> Dict[str, Any]:
        """Fallback анализ"""
        return {
            "summary": "Анализ содержания встречи",
            "key_points": ["Основные темы обсуждения"],
            "tasks": [],
            "decisions": [],
            "water_content": 0.3
        }
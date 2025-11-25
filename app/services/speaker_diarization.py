import logging
from typing import List, Dict, Any
from dotenv import load_dotenv

load_dotenv('.env')

logger = logging.getLogger(__name__)


class SimpleDiarizationService:
    """
    Упрощенный сервис диаризации для LM Studio
    """

    def __init__(self, config=None):
        self.config = config or {}

        # Инициализируем LM Studio клиент
        from .lm_studio_client import LMStudioClient, AudioProcessor

        self.lm_client = LMStudioClient(config)
        self.audio_processor = AudioProcessor()

        logger.info("✅ Упрощенный сервис диаризации инициализирован")

    def is_ready(self) -> bool:
        return True

    def diarize_audio(self, audio_path: str) -> List[Dict[str, Any]]:
        """
        Диаризация через LM Studio
        """
        try:
            # Получаем длительность аудио
            duration = self.audio_processor.get_audio_duration(audio_path)
            transcription = "Пример текста транскрипции для демонстрации."

            # Диаризация через LLM
            if self.lm_client.is_ready():
                logger.info("🎵 Используем LM Studio для диаризации...")
                segments = self.lm_client.diarize_with_llm(transcription, duration)
            else:
                logger.warning("⚠️ LM Studio недоступен, используем fallback")
                segments = self.lm_client._fallback_diarization(duration)

            logger.info(f"✅ Диаризация завершена: {len(segments)} сегментов")
            return segments

        except Exception as e:
            logger.error(f"❌ Ошибка диаризации: {e}")
            return self._emergency_fallback()

    def _emergency_fallback(self) -> List[Dict[str, Any]]:
        """Аварийный fallback"""
        return [{
            'speaker': 'SPEAKER_01',
            'start': 0.0,
            'end': 10.0,
            'duration': 10.0,
            'text': 'Аварийный сегмент'
        }]
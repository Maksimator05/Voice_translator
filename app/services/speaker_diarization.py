import logging
from typing import List, Tuple
import numpy as np
from app.models.meeting_models import SpeakerSegment, IdentifiedSpeaker, SpeakerRole

logger = logging.getLogger(__name__)


class SimpleSpeakerDiarizer:


    def __init__(self):
        self.speaker_counter = 0

    def detect_speaker_changes(self, text: str, timestamps: List[Tuple[float, float]]) -> List[SpeakerSegment]:

        segments = []

        # Эвристика: считаем, что пауза > 2 секунды - смена спикера
        current_speaker = "speaker_0"
        current_segment = []
        current_start = timestamps[0][0] if timestamps else 0

        for i, (start, end) in enumerate(timestamps):
            if i > 0:
                prev_end = timestamps[i - 1][1]
                pause_duration = start - prev_end

                if pause_duration > 2.0:  # Пауза более 2 секунд
                    # Завершаем текущий сегмент
                    if current_segment:
                        segment_text = " ".join(current_segment)
                        segments.append(SpeakerSegment(
                            speaker_id=current_speaker,
                            start_time=current_start,
                            end_time=prev_end,
                            text=segment_text,
                            confidence=0.8
                        ))

                    # Начинаем новый сегмент с новым спикером
                    current_speaker = f"speaker_{len(segments) % 3}"  # Максимум 3 спикера для MVP
                    current_segment = []
                    current_start = start

            current_segment.append(f"сегмент_{i}")  # Заглушка

        return segments[:3]  # Ограничиваем для MVP


class SpeakerDiarizationService:
    """Сервис разделения речи по спикерам"""

    def __init__(self):
        self.diarizer = SimpleSpeakerDiarizer()
        logger.info("Сервис диарайзации инициализирован")

    async def process_audio(self, audio_path: str) -> List[SpeakerSegment]:
        """
        Обработка аудио для разделения по спикерам.
        Пока заглушка - возвращаем одного спикера.
        """
        # Для 1-й лабораторной возвращаем заглушку
        return [
            SpeakerSegment(
                speaker_id="speaker_0",
                start_time=0.0,
                end_time=10.0,
                text="Речь спикера 1",
                confidence=0.9
            )
        ]
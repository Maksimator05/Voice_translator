import os
import logging
import requests
import json
from typing import List, Dict, Any, Optional
from dotenv import load_dotenv

load_dotenv('.env')

logger = logging.getLogger(__name__)


class LMStudioClient:
    """
    Клиент для работы с LM Studio API
    """

    def __init__(self, config=None):
        self.config = config or {
            'base_url': 'http://localhost:1234',
            'timeout': 60,
            'max_tokens': 1000,
            'temperature': 0.1
        }
        self.base_url = os.getenv('LM_STUDIO_URL', self.config['base_url'])
        logger.info(f"✅ LM Studio клиент инициализирован: {self.base_url}")

    def is_ready(self) -> bool:
        """Проверка доступности LM Studio"""
        try:
            response = requests.get(f"{self.base_url}/models", timeout=5)
            return response.status_code == 200
        except Exception:
            return False

    def transcribe_audio(self, audio_path: str) -> str:
        """
        Транскрипция аудио через LM Studio
        Пока заглушка - нужно настроить аудио обработку
        """
        # TODO: Реализовать преобразование аудио в текст для LM Studio
        # Временная заглушка
        return "Это пример транскрипции текста из аудио файла."

    def diarize_with_llm(self, transcription: str, audio_duration: float) -> List[Dict[str, Any]]:
        """
        Диаризация через LLM в LM Studio
        """
        try:
            prompt = self._create_diarization_prompt(transcription, audio_duration)

            response = self._send_completion_request(prompt)

            if response:
                return self._parse_llm_response(response, audio_duration)
            else:
                return self._fallback_diarization(audio_duration)

        except Exception as e:
            logger.error(f"❌ Ошибка диаризации через LLM: {e}")
            return self._fallback_diarization(audio_duration)

    def _create_diarization_prompt(self, transcription: str, duration: float) -> str:
        """Создание промпта для диаризации"""
        return f"""
Ты - эксперт по анализу аудио записей. Проанализируй следующий текст и определи сегменты с разными говорящими.

Длительность аудио: {duration} секунд
Транскрипция: "{transcription}"

Проанализируй текст и определи:
1. Сколько разных говорящих может быть в записи
2. Временные сегменты для каждого говорящего
3. Распределение времени между говорящими

Верни ответ в формате JSON:
{{
    "segments": [
        {{
            "speaker": "SPEAKER_01",
            "start": 0.0,
            "end": 5.0,
            "duration": 5.0,
            "text": "фрагмент текста"
        }}
    ]
}}

Текст транскрипции: {transcription}
"""

    def _send_completion_request(self, prompt: str) -> Optional[Dict]:
        """Отправка запроса к LM Studio"""
        try:
            url = f"{self.base_url}/v1/chat/completions"

            payload = {
                "model": os.getenv('LM_STUDIO_MODEL', 'local-model'),
                "messages": [
                    {
                        "role": "system",
                        "content": "Ты - эксперт по анализу аудио записей. Всегда отвечай в формате JSON."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                "max_tokens": self.config['max_tokens'],
                "temperature": self.config['temperature'],
                "stream": False
            }

            response = requests.post(
                url,
                json=payload,
                timeout=self.config['timeout']
            )

            if response.status_code == 200:
                return response.json()
            else:
                logger.error(f"❌ Ошибка LM Studio: {response.status_code}")
                return None

        except Exception as e:
            logger.error(f"❌ Ошибка запроса к LM Studio: {e}")
            return None

    def _parse_llm_response(self, response: Dict, audio_duration: float) -> List[Dict[str, Any]]:
        """Парсинг ответа от LLM"""
        try:
            content = response['choices'][0]['message']['content']

            # Пытаемся извлечь JSON из ответа
            if '```json' in content:
                json_str = content.split('```json')[1].split('```')[0]
            elif '```' in content:
                json_str = content.split('```')[1]
            else:
                json_str = content

            result = json.loads(json_str)
            return result.get('segments', [])

        except Exception:
            # Если парсинг не удался, используем fallback
            return self._fallback_diarization(audio_duration)

    def _fallback_diarization(self, duration: float) -> List[Dict[str, Any]]:
        """Резервная диаризация"""
        n_segments = max(1, min(3, int(duration / 10)))
        segments = []

        for i in range(n_segments):
            start = i * (duration / n_segments)
            end = (i + 1) * (duration / n_segments) if i < n_segments - 1 else duration
            segments.append({
                'speaker': f'SPEAKER_{i + 1:02d}',
                'start': round(start, 2),
                'end': round(end, 2),
                'duration': round(end - start, 2),
                'text': f'Сегмент {i + 1}'
            })

        return segments


class AudioProcessor:
    """
    Обработка аудио файлов
    """

    def __init__(self):
        logger.info("✅ Аудио процессор инициализирован")

    def get_audio_duration(self, audio_path: str) -> float:
        """Получение длительности аудио"""
        try:
            import librosa
            return librosa.get_duration(path=audio_path)
        except Exception as e:
            logger.error(f"❌ Ошибка получения длительности: {e}")
            return 10.0  # fallback

    def extract_audio_features(self, audio_path: str):
        """Извлечение признаков из аудио (для будущего ML)"""
        try:
            import librosa
            import numpy as np

            y, sr = librosa.load(audio_path, sr=16000)
            duration = len(y) / sr

            # Базовые признаки
            mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)
            spectral_centroid = librosa.feature.spectral_centroid(y=y, sr=sr)

            return {
                'duration': duration,
                'mfcc_mean': np.mean(mfcc, axis=1),
                'spectral_centroid_mean': np.mean(spectral_centroid)
            }
        except Exception as e:
            logger.error(f"❌ Ошибка извлечения признаков: {e}")
            return {'duration': 10.0}
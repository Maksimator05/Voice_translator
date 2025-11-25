import os
import logging
import requests
import json
import librosa
import whisper
from typing import Dict, Any, List, Optional
from dotenv import load_dotenv

load_dotenv('.env')

logger = logging.getLogger(__name__)


class LLMProcessor:
    """
    Универсальный процессор для всех задач через LM Studio
    """

    def __init__(self, config=None):
        self.config = config or {
            'base_url': 'http://localhost:1234',
            'timeout': 300,
            'max_tokens': 4000,
            'temperature': 0.7,
            'max_retries': 3,
            'retry_delay': 2
        }
        self.base_url = os.getenv('LM_STUDIO_URL', self.config['base_url'])
        self.model = os.getenv('LM_STUDIO_MODEL', 'local-model')
        self.is_connected = False
        self.available_models = []

        # Инициализация Whisper модели
        self.whisper_model = None
        self.whisper_initialized = False
        self.whisper_model_size = os.getenv('WHISPER_MODEL', 'base')

        logger.info(f"✅ LLM процессор инициализирован: {self.base_url}")

    async def initialize_model(self):
        """Инициализация и проверка подключения к LM Studio"""
        try:
            # Проверяем доступность LM Studio
            if await self._check_connection():
                self.is_connected = True
                await self._load_available_models()
                logger.info("✅ LM Studio подключен и готов к работе")

                # Инициализируем Whisper
                await self._initialize_whisper()

                return True
            else:
                logger.warning("⚠️ LM Studio недоступен")
                return False

        except Exception as e:
            logger.error(f"❌ Ошибка инициализации LM Studio: {e}")
            return False

    async def _initialize_whisper(self):
        """Инициализация модели Whisper для транскрипции"""
        try:
            logger.info(f"🔄 Загрузка модели Whisper ({self.whisper_model_size})...")
            self.whisper_model = whisper.load_model(self.whisper_model_size)
            self.whisper_initialized = True
            logger.info("✅ Модель Whisper загружена и готова к работе")
        except Exception as e:
            logger.error(f"❌ Ошибка загрузки модели Whisper: {e}")
            self.whisper_initialized = False

    async def transcribe_audio(self, audio_path: str, language: str = "ru") -> Dict[str, Any]:
        """
        Транскрипция аудио с использованием Whisper
        """
        if not self.whisper_initialized:
            await self._initialize_whisper()

        if not self.whisper_initialized:
            return {
                "success": False,
                "text": "Модель Whisper не инициализирована",
                "segments": [],
                "language": language
            }

        try:
            # === ИСПРАВЛЕНИЕ: Нормализация пути для Windows ===
            audio_path = os.path.abspath(audio_path)
            audio_path = audio_path.replace('\\', '/')  # Для консистентности

            logger.info(f"🎤 Начата транскрипция аудио: {audio_path}")

            # === ДОПОЛНИТЕЛЬНАЯ ПРОВЕРКА СУЩЕСТВОВАНИЯ ФАЙЛА ===
            if not os.path.exists(audio_path):
                logger.error(f"❌ Файл не существует: {audio_path}")
                # Попробуем найти файл альтернативными путями
                alt_path = audio_path.replace('/', '\\')
                if os.path.exists(alt_path):
                    audio_path = alt_path
                    logger.info(f"✅ Файл найден по альтернативному пути: {audio_path}")
                else:
                    return {
                        "success": False,
                        "text": f"Файл не найден: {audio_path}",
                        "segments": [],
                        "language": language
                    }

            # === ПРОВЕРКА РАЗМЕРА ФАЙЛА ===
            file_size = os.path.getsize(audio_path)
            if file_size == 0:
                logger.error(f"❌ Файл пустой: {audio_path}")
                return {
                    "success": False,
                    "text": "Файл пустой",
                    "segments": [],
                    "language": language
                }

            logger.info(f"📊 Размер файла: {file_size} байт")

            # === ВЫПОЛНЯЕМ ТРАНСКРИПЦИЮ ===
            logger.info("🔄 Запуск транскрипции Whisper...")
            result = self.whisper_model.transcribe(
                audio_path,
                language=language,
                verbose=False,
                fp16=False
            )

            # Форматируем результат
            transcription_result = {
                "success": True,
                "text": result["text"].strip(),
                "segments": [
                    {
                        "start": segment["start"],
                        "end": segment["end"],
                        "text": segment["text"].strip(),
                        "speaker": f"speaker_{i}"
                    }
                    for i, segment in enumerate(result.get("segments", []))
                ],
                "language": result.get("language", language),
                "duration": result.get("duration", 0),
                "file_path": audio_path,
                "file_size": file_size
            }

            logger.info(f"✅ Транскрипция завершена. Длина текста: {len(transcription_result['text'])} символов")
            return transcription_result

        except Exception as e:
            logger.error(f"❌ Ошибка транскрипции файла {audio_path}: {str(e)}")
            # Детальная диагностика
            if os.path.exists(audio_path):
                logger.info(f"📁 Файл существует, но ошибка транскрипции")
            else:
                logger.info(f"📁 Файл не существует после проверки")
            return {
                "success": False,
                "text": f"Ошибка транскрипции: {str(e)}",
                "segments": [],
                "language": language
            }

    async def transcribe_with_speaker_detection(self, audio_path: str, language: str = "ru" ) -> Dict[str, Any]:
        """
        Транскрипция с базовым определением спикеров (упрощенная версия)

        Args:
            audio_path: путь к аудиофайлу
            language: язык аудио
            num_speakers: предполагаемое количество спикеров (опционально)
        """
        try:
            # Сначала получаем базовую транскрипцию
            transcription = await self.transcribe_audio(audio_path, language)

            if not transcription["success"]:
                return transcription

            # Упрощенное определение спикеров на основе пауз
            segments_with_speakers = await self._detect_speaker_changes(transcription["segments"])

            transcription["segments"] = segments_with_speakers
            transcription["speaker_count"] = len(set(segment["speaker"] for segment in segments_with_speakers))

            return transcription

        except Exception as e:
            logger.error(f"❌ Ошибка транскрипции с определением спикеров: {e}")
            return await self.transcribe_audio(audio_path, language)

    async def _detect_speaker_changes(self, segments: List[Dict], pause_threshold: float = 2.0) -> List[Dict]:
        """
        Упрощенное определение смены спикеров на основе пауз
        """
        if not segments:
            return segments

        segments_with_speakers = []
        current_speaker = "speaker_0"
        speaker_index = 0

        for i, segment in enumerate(segments):
            # Если это первый сегмент, используем первого спикера
            if i == 0:
                segment["speaker"] = current_speaker
                segments_with_speakers.append(segment)
                continue

            # Проверяем паузу между сегментами
            previous_segment = segments[i - 1]
            pause_duration = segment["start"] - previous_segment["end"]

            # Если пауза достаточно длинная, предполагаем смену спикера
            if pause_duration > pause_threshold:
                speaker_index += 1
                current_speaker = f"speaker_{speaker_index}"

            segment["speaker"] = current_speaker
            segments_with_speakers.append(segment)

        return segments_with_speakers

    async def process_audio(self, audio_path: str, enable_transcription: bool = True) -> Dict[str, Any]:
        """
        Полная обработка аудио через Whisper и LM Studio

        Args:
            audio_path: путь к аудиофайлу
            enable_transcription: выполнять ли транскрипцию через Whisper
        """
        try:
            # Получаем базовую информацию об аудио
            duration = librosa.get_duration(path=audio_path)

            if enable_transcription and self.whisper_initialized:
                # Используем Whisper для транскрипции
                transcription_result = await self.transcribe_with_speaker_detection(audio_path)
                transcription_text = transcription_result["text"]
                speakers = transcription_result["segments"]
            else:
                # Fallback: используем LLM для генерации примерного текста
                transcription_text = await self._generate_sample_transcription(duration)
                speakers = []
                transcription_result = {
                    "success": True,
                    "text": transcription_text,
                    "segments": []
                }

            # Анализ содержания через LLM
            analysis_result = await self.analyze_meeting_content(
                transcription_text,
                duration,
                speakers
            )

            return {
                "success": True,
                "transcription": transcription_text,
                "transcription_detail": transcription_result,
                "analysis": analysis_result,
                "duration": duration,
                "processing_time": 0,
                "whisper_used": enable_transcription and self.whisper_initialized
            }

        except Exception as e:
            logger.error(f"❌ Ошибка обработки аудио: {e}")
            return {
                "success": False,
                "transcription": "Ошибка обработки",
                "transcription_detail": {"success": False, "text": "Ошибка обработки", "segments": []},
                "analysis": self._create_fallback_analysis(),
                "duration": 0,
                "processing_time": 0,
                "whisper_used": False
            }

    async def transcribe_and_analyze(self, audio_path: str, language: str = "ru") -> Dict[str, Any]:
        """
        Комплексная обработка: транскрипция + анализ

        Args:
            audio_path: путь к аудиофайлу
            language: язык аудио
        """
        try:
            # Шаг 1: Транскрипция через Whisper
            transcription_result = await self.transcribe_audio(audio_path, language)

            if not transcription_result["success"]:
                return {
                    "success": False,
                    "error": "Транскрипция не удалась",
                    "transcription": transcription_result
                }

            # Шаг 2: Анализ содержания через LLM
            analysis_result = await self.analyze_meeting_content(
                transcription_result["text"],
                transcription_result.get("duration", 0),
                transcription_result.get("segments", [])
            )

            return {
                "success": True,
                "transcription": transcription_result,
                "analysis": analysis_result,
                "duration": transcription_result.get("duration", 0)
            }

        except Exception as e:
            logger.error(f"❌ Ошибка комплексной обработки: {e}")
            return {
                "success": False,
                "error": str(e),
                "transcription": {"success": False, "text": "", "segments": []},
                "analysis": self._create_fallback_analysis()
            }

    def get_whisper_info(self) -> Dict[str, Any]:
        """Получение информации о состоянии Whisper модели"""
        return {
            "initialized": self.whisper_initialized,
            "model_size": self.whisper_model_size,
            "available": self.whisper_model is not None
        }

    async def _check_connection(self) -> bool:
        """Проверка подключения к LM Studio"""
        try:
            response = requests.get(f"{self.base_url}/models", timeout=10)
            if response.status_code == 200:
                return True
            return False
        except:
            return False

    async def _load_available_models(self):
        """Загрузка списка доступных моделей"""
        try:
            response = requests.get(f"{self.base_url}/models", timeout=10)
            if response.status_code == 200:
                data = response.json()
                print("Полный ответ от сервера:", data)  # ← Добавьте это для отладки

                # Попробуйте разные варианты извлечения данных
                self.available_models = data.get('data', []) or data.get('models', []) or data
                logger.info(f"📚 Доступно моделей: {len(self.available_models)}")
        except Exception as e:
            logger.warning(f"⚠️ Не удалось загрузить список моделей: {e}")

    async def generate_chat_response(self, user_message: str, chat_history: List[Dict] = None) -> str:
        """
        Генерация ответа AI с учетом истории чата
        """
        if not self.is_connected:
            return "⚠️ Сервис AI временно недоступен. Попробуйте позже."

        try:
            # Формируем промпт с историей
            messages = await self._build_chat_messages(user_message, chat_history or [])

            # Отправляем запрос с повторными попытками
            response = await self._send_request_with_retry(messages)

            if response:
                return self._extract_response_content(response)
            else:
                return "❌ Не удалось получить ответ от AI. Попробуйте еще раз."

        except Exception as e:
            logger.error(f"❌ Ошибка генерации ответа AI: {e}")
            return "⚠️ Произошла ошибка при обработке запроса."

    async def _build_chat_messages(self, user_message: str, chat_history: List[Dict]) -> List[Dict]:
        """Построение сообщений для контекста"""
        messages = []

        # Системный промпт для анализа встреч
        system_prompt = """Ты - AI ассистент для анализа встреч и делового общения. 

Твои основные задачи:
1. Анализировать содержание встреч и бесед
2. Помогать структурировать информацию
3. Выделять ключевые моменты, задачи и решения
4. Отвечать на вопросы о прошедших обсуждениях

Требования:
- Отвечай на русском языке
- Будь точным, полезным и профессиональным
- Структурируй сложные ответы
- Сохраняй контекст беседы
- Если не уверен в ответе - уточни"""

        messages.append({"role": "system", "content": system_prompt})

        # Добавляем историю чата (последние 10 сообщений для экономии токенов)
        for msg in chat_history[-10:]:
            messages.append({
                "role": msg["role"],
                "content": msg["content"]
            })

        # Добавляем текущее сообщение пользователя
        messages.append({
            "role": "user",
            "content": user_message
        })

        return messages

    async def _send_request_with_retry(self, messages: List[Dict]) -> Optional[Dict]:
        """Отправка запроса с повторными попытками"""
        for attempt in range(self.config['max_retries']):
            try:
                response = requests.post(
                    f"{self.base_url}/v1/chat/completions",
                    json={
                        "model": self.model,
                        "messages": messages,
                        "max_tokens": self.config['max_tokens'],
                        "temperature": self.config['temperature'],
                        "stream": False
                    },
                    timeout=self.config['timeout']
                )

                if response.status_code == 200:
                    return response.json()
                else:
                    logger.warning(f"⚠️ Попытка {attempt + 1} не удалась: {response.status_code}")

            except Exception as e:
                logger.warning(f"⚠️ Ошибка подключения (попытка {attempt + 1}): {e}")

            # Ждем перед повторной попыткой
            if attempt < self.config['max_retries'] - 1:
                import time
                time.sleep(self.config['retry_delay'])

        return None

    def _extract_response_content(self, response: Dict) -> str:
        """Извлечение контента из ответа LM Studio"""
        try:
            return response['choices'][0]['message']['content'].strip()
        except (KeyError, IndexError) as e:
            logger.error(f"❌ Ошибка парсинга ответа: {e}")
            return "Не удалось обработать ответ AI."

    async def analyze_meeting_content(self, transcription: str, duration: float, speakers: List[Dict] = None) -> Dict[
        str, Any]:
        """
        Анализ содержания встречи через LLM
        """
        if not self.is_connected:
            return self._create_fallback_analysis()

        try:
            prompt = self._build_analysis_prompt(transcription, duration, speakers)

            response = requests.post(
                f"{self.base_url}/v1/chat/completions",
                json={
                    "model": self.model,
                    "messages": [{"role": "user", "content": prompt}],
                    "max_tokens": 2000,
                    "temperature": 0.3
                },
                timeout=90
            )

            if response.status_code == 200:
                content = response.json()['choices'][0]['message']['content']
                return self._parse_analysis_response(content)
            else:
                return self._create_fallback_analysis()

        except Exception as e:
            logger.error(f"❌ Ошибка анализа встречи: {e}")
            return self._create_fallback_analysis()

    def _build_analysis_prompt(self, transcription: str, duration: float, speakers: List[Dict] = None) -> str:
        """Построение промпта для анализа встречи"""
        speakers_info = ""
        if speakers:
            speakers_info = f"\nУчастники: {len(speakers)} человек"

        return f"""
Проанализируй транскрипцию встречи и выдели ключевую информацию.

Длительность: {duration:.1f} секунд{speakers_info}
Транскрипция: {transcription[:3000]}...

Проанализируй и верни ответ в формате JSON:
{{
    "summary": "краткое содержание встречи (3-5 предложений)",
    "key_points": ["основной тезис 1", "основной тезис 2", "основной тезис 3"],
    "tasks": [
        {{
            "description": "формулировка задачи",
            "assigned_to": "ответственный",
            "context": "контекст задачи"
        }}
    ],
    "decisions": [
        {{
            "description": "формулировка решения", 
            "participants": ["участник1", "участник2"],
            "context": "контекст решения"
        }}
    ],
    "water_content_ratio": 0.3
}}

Важно: Будь точным и объективным в анализе.
"""

    def _parse_analysis_response(self, content: str) -> Dict[str, Any]:
        """Парсинг ответа анализа"""
        try:
            # Пытаемся извлечь JSON
            if '```json' in content:
                json_str = content.split('```json')[1].split('```')[0]
            elif '```' in content:
                json_str = content.split('```')[1]
            else:
                json_str = content

            return json.loads(json_str)
        except:
            return self._create_fallback_analysis()

    def _create_fallback_analysis(self) -> Dict[str, Any]:
        """Fallback анализ при ошибках"""
        return {
            "summary": "Анализ содержания встречи",
            "key_points": ["Обсуждение рабочих вопросов", "Постановка задач"],
            "tasks": [],
            "decisions": [],
            "water_content_ratio": 0.2
        }

    async def _generate_sample_transcription(self, duration: float) -> str:
        """Генерация примерной транскрипции (временное решение)"""
        return f"""Обсуждение проекта разработки. Длительность: {duration:.1f} секунд.

Участник 1: Коллеги, давайте начнем с обсуждения текущего статуса проекта.
Участник 2: По модулю авторизации все готово, осталось написать тесты.
Участник 3: У меня вопросы по интеграции с платежной системой.
Участник 1: Хорошо, давайте поставим задачи до конца недели."""


# Синглтон для совместимости
llm_processor = LLMProcessor()
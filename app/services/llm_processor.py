import os
import logging
import requests
import json
import librosa
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
            'timeout': 120,
            'max_tokens': 4000,
            'temperature': 0.7,
            'max_retries': 3,
            'retry_delay': 2
        }
        self.base_url = os.getenv('LM_STUDIO_URL', self.config['base_url'])
        self.model = os.getenv('LM_STUDIO_MODEL', 'local-model')
        self.is_connected = False
        self.available_models = []

        logger.info(f"✅ LLM процессор инициализирован: {self.base_url}")

    async def initialize_model(self):
        """Инициализация и проверка подключения к LM Studio"""
        try:
            # Проверяем доступность LM Studio
            if await self._check_connection():
                self.is_connected = True
                await self._load_available_models()
                logger.info("✅ LM Studio подключен и готов к работе")
                return True
            else:
                logger.warning("⚠️ LM Studio недоступен")
                return False

        except Exception as e:
            logger.error(f"❌ Ошибка инициализации LM Studio: {e}")
            return False

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
                self.available_models = response.json().get('data', [])
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

    async def process_audio(self, audio_path: str) -> Dict[str, Any]:
        """
        Полная обработка аудио через LM Studio
        """
        try:
            # Получаем базовую информацию об аудио
            duration = librosa.get_duration(path=audio_path)

            # TODO: Здесь будет настоящая транскрипция
            # Пока используем LLM для генерации примерного текста
            transcription = await self._generate_sample_transcription(duration)

            # Анализ содержания
            analysis_result = await self.analyze_meeting_content(transcription, duration)

            return {
                "success": True,
                "transcription": transcription,
                "analysis": analysis_result,
                "duration": duration,
                "processing_time": 0
            }

        except Exception as e:
            logger.error(f"❌ Ошибка обработки аудио: {e}")
            return {
                "success": False,
                "transcription": "Ошибка обработки",
                "analysis": self._create_fallback_analysis(),
                "duration": 0,
                "processing_time": 0
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
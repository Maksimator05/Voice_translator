import logging
from typing import Dict, Any, List, Optional
from .llm_processor import LLMProcessor

logger = logging.getLogger(__name__)


class ContentProcessor:
    """Процессор для анализа содержания встреч с использованием LLMProcessor"""

    def __init__(self, config: Optional[Dict] = None):
        self.config = config or {}
        self.llm_processor = LLMProcessor(config)
        logger.info("✅ ContentProcessor инициализирован")

    async def initialize(self) -> bool:
        """Инициализация процессора"""
        try:
            await self.llm_processor.initialize_model()
            logger.info("✅ ContentProcessor готов к работе")
            return True
        except Exception as e:
            logger.error(f"❌ Ошибка инициализации ContentProcessor: {e}")
            return False

    async def process_meeting_content(self,
                                      transcription: str,
                                      duration: float,
                                      speakers: Dict = None,
                                      segments: List[Dict] = None) -> Dict[str, Any]:
        """
        Полный анализ содержания встречи через LLMProcessor
        """
        try:
            if not transcription or transcription.strip() == "":
                logger.warning("⚠️ Пустая транскрипция, возвращаем fallback")
                return self._create_fallback_analysis()

            # Используем LLMProcessor для анализа
            analysis_result = await self.llm_processor.analyze_meeting_content(
                transcription=transcription,
                duration=duration,
                speakers=segments or []  # Передаем сегменты как speakers
            )

            # Если LLM не доступен, используем локальный анализ
            if not analysis_result or "error" in analysis_result:
                logger.info("⚠️ LLM недоступен, используем локальный анализ")
                analysis_result = await self._local_content_analysis(transcription, duration, segments)

            # Добавляем мета-информацию
            analysis_result.update({
                "transcription_length": len(transcription),
                "duration_seconds": duration,
                "speakers_count": len(speakers) if speakers else 0,
                "segments_count": len(segments) if segments else 0,
                "analysis_method": "llm" if self.llm_processor.is_connected else "local"
            })

            logger.info(f"✅ Анализ содержания завершен: {len(analysis_result.get('key_points', []))} ключевых пунктов")
            return analysis_result

        except Exception as e:
            logger.error(f"❌ Ошибка обработки содержания: {e}")
            return self._create_fallback_analysis()

    async def _local_content_analysis(self, transcription: str) -> Dict[
        str, Any]:
        """Локальный анализ содержания если LLM недоступен"""
        try:
            # Простой анализ на основе ключевых слов
            words = transcription.lower().split()
            word_count = len(words)

            # Определяем "water content" (процент воды в речи)
            water_words = ['ну', 'это', 'как', 'так', 'вот', 'типа', 'значит', 'короче']
            water_count = sum(1 for word in words if word in water_words)
            water_content = round(water_count / max(word_count, 1), 2)

            # Извлекаем ключевые темы
            key_points = self._extract_key_points(transcription)

            # Ищем задачи
            tasks = self._extract_tasks(transcription)

            # Ищем решения
            decisions = self._extract_decisions(transcription)

            return {
                "summary": self._generate_summary(transcription, key_points),
                "key_points": key_points,
                "tasks": tasks,
                "decisions": decisions,
                "water_content_ratio": water_content
            }

        except Exception as e:
            logger.error(f"❌ Ошибка локального анализа: {e}")
            return self._create_fallback_analysis()

    def _extract_key_points(self, text: str) -> List[str]:
        """Извлекает ключевые пункты из текста"""
        key_points = []
        sentences = [s.strip() for s in text.split('.') if s.strip()]

        # Ищем предложения с ключевыми словами
        key_indicators = ['важно', 'ключевой', 'основной', 'главный', 'необходимо', 'следует', 'итог', 'вывод']

        for sentence in sentences:
            if any(indicator in sentence.lower() for indicator in key_indicators):
                if len(sentence) > 10 and len(sentence) < 200:  # Фильтруем по длине
                    key_points.append(sentence)

            # Ограничиваем количество ключевых пунктов
            if len(key_points) >= 5:
                break

        return key_points if key_points else ["Основные темы обсуждения"]

    def _extract_tasks(self, text: str) -> List[Dict[str, str]]:
        """Извлекает задачи из текста"""
        tasks = []
        sentences = [s.strip() for s in text.split('.') if s.strip()]

        task_indicators = ['сделать', 'подготовить', 'написать', 'исправить', 'доделать', 'завершить', 'разработать']
        assignment_indicators = ['поручаю', 'назначить', 'ответственный', 'возьмет', 'займется']

        for sentence in sentences:
            sentence_lower = sentence.lower()

            # Проверяем, есть ли индикаторы задач
            has_task = any(indicator in sentence_lower for indicator in task_indicators)
            has_assignment = any(indicator in sentence_lower for indicator in assignment_indicators)

            if has_task:
                task = {
                    "description": sentence,
                    "assigned_to": "Не назначено",
                    "context": "Извлечено из обсуждения"
                }

                # Пытаемся определить ответственного
                if has_assignment:
                    # Простая эвристика для определения ответственного
                    words = sentence.split()
                    for i, word in enumerate(words):
                        if word.lower() in assignment_indicators and i + 1 < len(words):
                            task["assigned_to"] = words[i + 1]
                            break

                tasks.append(task)

            if len(tasks) >= 3:
                break

        return tasks

    def _extract_decisions(self, text: str) -> List[Dict[str, str]]:
        """Извлекает решения из текста"""
        decisions = []
        sentences = [s.strip() for s in text.split('.') if s.strip()]

        decision_indicators = ['решили', 'договорились', 'утвердили', 'приняли', 'согласовали', 'постановили']

        for sentence in sentences:
            if any(indicator in sentence.lower() for indicator in decision_indicators):
                decisions.append({
                    "description": sentence,
                    "participants": ["Участники встречи"],
                    "context": "Принятое решение"
                })

            if len(decisions) >= 2:
                break

        return decisions

    def _generate_summary(self, text: str, key_points: List[str]) -> str:
        """Генерирует краткое содержание"""
        if key_points and len(key_points) > 0:
            return f"Обсуждение: {key_points[0]}"

        # Берем первые 100 символов как summary
        clean_text = text.replace('\n', ' ').strip()
        if len(clean_text) > 100:
            return clean_text[:100] + "..."
        return clean_text if clean_text else "Обсуждение рабочих вопросов"

    def _create_fallback_analysis(self) -> Dict[str, Any]:
        """Fallback анализ при ошибках"""
        return {
            "summary": "Анализ содержания встречи",
            "key_points": ["Основные темы обсуждения"],
            "tasks": [],
            "decisions": [],
            "water_content_ratio": 0.3,
            "analysis_method": "fallback"
        }

    async def transcribe_audio(self, audio_path: str) -> Dict[str, Any]:
        """Транскрипция аудио через LLMProcessor"""
        return await self.llm_processor.transcribe_audio(audio_path)
import logging
import re
from typing import List, Dict, Any, Optional
from app.models.meeting_models import *
from app.config import settings

logger = logging.getLogger(__name__)


class MeetingAnalyzer:
    """Анализатор содержания встреч"""

    def __init__(self):
        self.task_patterns = self._compile_task_patterns()
        self.water_words = self._get_water_words()  # ← ДОБАВЛЕНО
        logger.info("Анализатор встреч инициализирован")

    def _compile_task_patterns(self) -> List[re.Pattern]:
        """Компиляция паттернов для поиска задач"""
        patterns = [
            re.compile(r'(\w+)[:\s]+(к|до)\s+(\d+\s+\w+)\s+(.*?)(?=\.|$)', re.IGNORECASE),
            re.compile(r'(\w+)[,\s]+(подготовь|сделай|напиши)\s+(.*?)(?=\.|$)', re.IGNORECASE),
        ]
        return patterns

    def _get_water_words(self) -> List[str]:
        """Слова-паразиты для анализа воды"""
        return [
            "так", "сказать", "значит", "в общем", "короче", "типа",
            "например", "как бы", "это", "самое", "ну", "вот", "в принципе",
            "собственно", "допустим", "конкретно"
        ]

    def extract_tasks(self, text: str, speakers: List[str]) -> List[TaskItem]:
        """Извлечение задач из текста"""
        tasks = []

        # Простой поиск по ключевым словам
        for keyword in settings.TASK_KEYWORDS:
            if keyword in text.lower():
                # Находим контекст вокруг ключевого слова
                start = max(0, text.lower().find(keyword) - 100)
                end = min(len(text), start + 200)
                context = text[start:end]

                # Пытаемся определить ответственного
                assigned_to = self._detect_assignee(context, speakers)

                tasks.append(TaskItem(
                    description=f"Задача связанная с '{keyword}'",
                    assigned_to=assigned_to or "Не определен",
                    context=context,
                    confidence=0.7
                ))

        return tasks[:5]

    def _detect_assignee(self, text: str, speakers: List[str]) -> Optional[str]:
        """Определение ответственного по контексту"""
        for speaker in speakers:
            if speaker.lower() in text.lower():
                return speaker
        return None

    def analyze_water_content(self, text: str) -> float:
        """Анализ содержания 'воды' в тексте"""
        if not text or len(text.strip()) == 0:
            return 0.0

        sentences = re.split(r'[.!?]+', text)
        sentences = [s.strip() for s in sentences if len(s.strip()) > 0]

        if not sentences:
            return 0.0

        water_sentences = 0
        for sentence in sentences:
            words = sentence.split()

            if len(words) < 4:  # Очень короткие предложения
                water_sentences += 1
                continue

            water_word_count = sum(1 for word in words if word.lower() in self.water_words)
            if water_word_count >= 2:
                water_sentences += 1
            elif len(words) > 0 and water_word_count / len(words) > 0.3:
                water_sentences += 1

        return round(water_sentences / len(sentences), 2)

    def generate_summary(self, text: str, max_sentences: int = 3) -> str:
        """Генерация краткого содержания"""
        sentences = re.split(r'[.!?]+', text)
        sentences = [s.strip() for s in sentences if len(s.strip()) > 10]  # Берем только осмысленные

        if len(sentences) <= max_sentences:
            return ". ".join(sentences) + "."
        else:
            # Берем первое, последнее и одно из середины
            selected = [sentences[0], sentences[len(sentences) // 2], sentences[-1]]
            return ". ".join(selected) + "."


class ContentProcessor:
    """Обработчик контента встречи"""

    def __init__(self):
        self.analyzer = MeetingAnalyzer()

    async def process_meeting_content(self, raw_text: str, duration: float) -> Dict[str, Any]:
        """
        Основная обработка содержания встречи.
        """
        water_content = self.analyzer.analyze_water_content(raw_text)
        summary = self.analyzer.generate_summary(raw_text)

        return {
            "key_points": [f"Основные тезисы (водность: {water_content * 100}%)"],
            "tasks": [],
            "decisions": [],
            "water_content": water_content,
            "summary": summary
        }
import logging
import os
import uuid
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.models.chat_models import ChatSession, ChatMessage
from app.models.chat_schemas import (
    ChatSessionCreate,
    ChatSessionResponse,
    ChatMessageCreate,
    ChatMessageResponse,
    ChatSessionListResponse
)

logger = logging.getLogger(__name__)


class ChatService:
    """Сервис для работы с чатами и сообщениями"""

    def __init__(self, db: Session):
        self.db = db

    def create_chat_session(self, user_id: int, chat_data: ChatSessionCreate) -> ChatSessionResponse:
        """Создание новой сессии чата"""
        try:
            # Конвертируем Enum в строку для сохранения в БД
            session_type_str = chat_data.session_type.value

            db_chat = ChatSession(
                user_id=user_id,
                title=chat_data.title,
                session_type=session_type_str
            )

            self.db.add(db_chat)
            self.db.commit()
            self.db.refresh(db_chat)

            logger.info(f"✅ Создана новая сессия чата: {db_chat.title} для пользователя {user_id}")

            # В ответе используем оригинальный Enum
            return ChatSessionResponse(
                id=db_chat.id,
                user_id=db_chat.user_id,
                title=db_chat.title,
                session_type=chat_data.session_type,
                created_at=db_chat.created_at,
                updated_at=db_chat.updated_at,
                is_active=db_chat.is_active,
                messages=[]
            )

        except Exception as e:
            self.db.rollback()
            logger.error(f"❌ Ошибка создания сессии чата: {e}")
            raise

    def get_user_chat_sessions(self, user_id: int) -> List[ChatSessionListResponse]:
        """Получение списка чатов пользователя с последним сообщением"""
        try:
            chat_sessions = self.db.query(ChatSession) \
                .filter(ChatSession.user_id == user_id, ChatSession.is_active == True) \
                .order_by(desc(ChatSession.updated_at)) \
                .all()

            result = []
            for chat in chat_sessions:
                # Получаем последнее сообщение
                last_message = self.db.query(ChatMessage) \
                    .filter(ChatMessage.chat_session_id == chat.id) \
                    .order_by(desc(ChatMessage.created_at)) \
                    .first()

                # Считаем количество сообщений
                message_count = self.db.query(ChatMessage) \
                    .filter(ChatMessage.chat_session_id == chat.id) \
                    .count()

                # Конвертируем строку обратно в Enum для ответа
                from app.models.chat_schemas import SessionType
                session_type_enum = SessionType(chat.session_type)

                result.append(ChatSessionListResponse(
                    id=chat.id,
                    title=chat.title,
                    session_type=session_type_enum,
                    created_at=chat.created_at,
                    updated_at=chat.updated_at,
                    last_message=last_message.content if last_message else None,
                    message_count=message_count
                ))

            logger.info(f"✅ Получено {len(result)} чатов для пользователя {user_id}")
            return result

        except Exception as e:
            logger.error(f"❌ Ошибка получения списка чатов: {e}")
            raise

    def get_chat_session(self, chat_id: int, user_id: int) -> Optional[ChatSessionResponse]:
        """Получение конкретного чата с сообщениями"""
        try:
            chat_session = self.db.query(ChatSession) \
                .filter(ChatSession.id == chat_id, ChatSession.user_id == user_id) \
                .first()

            if not chat_session:
                return None

            # Получаем сообщения чата
            messages = self.db.query(ChatMessage) \
                .filter(ChatMessage.chat_session_id == chat_id) \
                .order_by(ChatMessage.created_at) \
                .all()

            # Конвертируем строку обратно в Enum
            from app.models.chat_schemas import SessionType
            session_type_enum = SessionType(chat_session.session_type)

            # Вручную создаем ответ
            message_responses = []
            for msg in messages:
                from app.models.chat_schemas import MessageType
                message_type_enum = MessageType(msg.message_type)

                message_responses.append(ChatMessageResponse(
                    id=msg.id,
                    chat_session_id=msg.chat_session_id,
                    role=msg.role,
                    content=msg.content,
                    message_type=message_type_enum,
                    tokens_used=msg.tokens_used,
                    created_at=msg.created_at
                ))

            return ChatSessionResponse(
                id=chat_session.id,
                user_id=chat_session.user_id,
                title=chat_session.title,
                session_type=session_type_enum,
                created_at=chat_session.created_at,
                updated_at=chat_session.updated_at,
                is_active=chat_session.is_active,
                messages=message_responses
            )

        except Exception as e:
            logger.error(f"❌ Ошибка получения чата {chat_id}: {e}")
            raise

    async def add_message_to_chat(self, chat_id: int, user_id: int, message_data: ChatMessageCreate,
                                  audio_file_path=None) -> ChatMessageResponse:
        """Добавление сообщения в чат"""
        try:
            # Проверяем существование чата и права доступа
            chat_session = self.db.query(ChatSession) \
                .filter(ChatSession.id == chat_id, ChatSession.user_id == user_id) \
                .first()

            if not chat_session:
                raise ValueError("Чат не найден или нет доступа")

            # Обрабатываем аудио если есть
            audio_filename = None
            audio_transcription = None
            audio_analysis = None

            if audio_file_path and os.path.exists(audio_file_path):
                # Сохраняем аудио файл
                audio_filename = f"audio_{uuid.uuid4().hex[:8]}.wav"
                audio_save_path = os.path.join("uploads", audio_filename)
                os.rename(audio_file_path, audio_save_path)

                # Транскрибируем и анализируем аудио
                from app.services.llm_processor import llm_processor
                audio_result = await llm_processor.process_audio(audio_save_path)

                if audio_result["success"]:
                    audio_transcription = audio_result["transcription"]
                    audio_analysis = audio_result["analysis"]

            # Конвертируем Enum в строку
            message_type_str = message_data.message_type


            # Создаем сообщение
            db_message = ChatMessage(
                chat_session_id=chat_id,
                role=message_data.role,
                content=message_data.content,
                message_type=message_type_str
            )

            self.db.add(db_message)

            # Обновляем время изменения чата
            from sqlalchemy import func
            chat_session.updated_at = func.now()

            self.db.commit()
            self.db.refresh(db_message)

            logger.info(f"✅ Добавлено сообщение в чат {chat_id}, роль: {message_data.role}")

            # В ответе используем оригинальный Enum
            from app.models.chat_schemas import MessageType
            return ChatMessageResponse(
                id=db_message.id,
                chat_session_id=db_message.chat_session_id,
                role=db_message.role,
                content=db_message.content,
                message_type=message_data.message_type,
                tokens_used=db_message.tokens_used,
                created_at=db_message.created_at
            )

        except Exception as e:
            self.db.rollback()
            logger.error(f"❌ Ошибка добавления сообщения: {e}")
            raise

    def get_chat_messages(self, chat_id: int, user_id: int, limit: int = 50) -> List[ChatMessageResponse]:
        """Получение сообщений чата"""
        try:
            # Проверяем права доступа
            chat_session = self.db.query(ChatSession) \
                .filter(ChatSession.id == chat_id, ChatSession.user_id == user_id) \
                .first()

            if not chat_session:
                raise ValueError("Чат не найден или нет доступа")

            messages = self.db.query(ChatMessage) \
                .filter(ChatMessage.chat_session_id == chat_id) \
                .order_by(ChatMessage.created_at) \
                .limit(limit) \
                .all()

            # Вручную создаем ответы
            from app.models.chat_schemas import MessageType
            return [
                ChatMessageResponse(
                    id=msg.id,
                    chat_session_id=msg.chat_session_id,
                    role=msg.role,
                    content=msg.content,
                    message_type=MessageType(msg.message_type),
                    tokens_used=msg.tokens_used,
                    created_at=msg.created_at
                ) for msg in messages
            ]

        except Exception as e:
            logger.error(f"❌ Ошибка получения сообщений чата {chat_id}: {e}")
            raise

    def update_chat_title(self, chat_id: int, user_id: int, new_title: str) -> ChatSessionResponse:
        """Обновление названия чата"""
        try:
            chat_session = self.db.query(ChatSession) \
                .filter(ChatSession.id == chat_id, ChatSession.user_id == user_id) \
                .first()

            if not chat_session:
                raise ValueError("Чат не найден или нет доступа")

            chat_session.title = new_title
            self.db.commit()
            self.db.refresh(chat_session)

            logger.info(f"✅ Обновлено название чата {chat_id} на '{new_title}'")

            # Получаем сообщения для ответа
            messages = self.get_chat_messages(chat_id, user_id)

            # Конвертируем строку обратно в Enum
            from app.models.chat_schemas import SessionType
            session_type_enum = SessionType(chat_session.session_type)

            return ChatSessionResponse(
                id=chat_session.id,
                user_id=chat_session.user_id,
                title=chat_session.title,
                session_type=session_type_enum,
                created_at=chat_session.created_at,
                updated_at=chat_session.updated_at,
                is_active=chat_session.is_active,
                messages=messages
            )

        except Exception as e:
            self.db.rollback()
            logger.error(f"❌ Ошибка обновления названия чата: {e}")
            raise

    def delete_chat_session(self, chat_id: int, user_id: int) -> bool:
        """Удаление чата (мягкое удаление)"""
        try:
            chat_session = self.db.query(ChatSession) \
                .filter(ChatSession.id == chat_id, ChatSession.user_id == user_id) \
                .first()

            if not chat_session:
                return False

            chat_session.is_active = False
            self.db.commit()

            logger.info(f"✅ Чат {chat_id} удален (мягкое удаление)")
            return True

        except Exception as e:
            self.db.rollback()
            logger.error(f"❌ Ошибка удаления чата: {e}")
            raise

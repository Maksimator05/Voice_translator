from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class FileAttachmentResponse(BaseModel):
    id: int
    user_id: int
    chat_session_id: Optional[int] = None
    original_filename: str
    content_type: str
    file_size: int
    created_at: datetime

    class Config:
        from_attributes = True


class FileDownloadResponse(BaseModel):
    url: str
    expires_in: int = 3600

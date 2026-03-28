from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field, HttpUrl


class ExternalResourceItem(BaseModel):
    id: str
    title: str
    authors: List[str]
    description: Optional[str] = None
    resource_url: HttpUrl
    thumbnail_url: Optional[HttpUrl] = None
    published_date: Optional[str] = None
    categories: List[str] = Field(default_factory=list)
    source: str


class ExternalResourceSearchResponse(BaseModel):
    query: str
    items: List[ExternalResourceItem]
    total: int
    source: str
    cached: bool
    fetched_at: datetime

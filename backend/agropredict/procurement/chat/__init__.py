"""Conversational chat surface for the procurement pipeline.

Exposes a single ``/chat/message`` endpoint that classifies a
natural-language buyer request, routes it to the existing procurement
agents/services (comparator, recommender, extractor, weather, FX), and
returns a structured response that the chat UI can render.
"""

from .schemas import ChatMessageRequest, ChatMessageResponse
from .service import ChatService

__all__ = ["ChatService", "ChatMessageRequest", "ChatMessageResponse"]

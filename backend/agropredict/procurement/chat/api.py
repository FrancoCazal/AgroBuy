"""HTTP surface for the procurement chat service."""

from __future__ import annotations

from fastapi import APIRouter

from .schemas import ChatMessageRequest, ChatMessageResponse
from .service import ChatService


def build_chat_router(service: ChatService) -> APIRouter:
    router = APIRouter(prefix="/api/v1/procurement/chat", tags=["procurement-chat"])

    @router.post("/message", response_model=ChatMessageResponse)
    def post_message(payload: ChatMessageRequest) -> ChatMessageResponse:
        return service.handle(
            payload.message,
            tenant_id=payload.tenant_id,
            team_id=payload.team_id,
            request_id_hint=payload.request_id,
        )

    return router

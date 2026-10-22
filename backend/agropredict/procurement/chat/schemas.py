"""Wire schemas for the procurement chat endpoint."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field

ChatIntent = Literal[
    "compare_request",
    "recommend_request",
    "extract_quotation",
    "weather_forecast",
    "fx_rate",
    "list_requests",
    "list_suppliers",
    "help",
    "unknown",
]


class ChatMessageRequest(BaseModel):
    """Inbound chat message from the buyer UI."""

    message: str = Field(..., min_length=1, max_length=8000)
    tenant_id: str
    team_id: str | None = None
    request_id: str | None = Field(
        default=None,
        description="Optional active purchase request id to scope the answer.",
    )


class ChatActionLink(BaseModel):
    """Navigation hint the UI can render as a button."""

    label: str
    href: str


class ChatMessageResponse(BaseModel):
    """Reply emitted by the orchestrator."""

    intent: ChatIntent
    reply: str = Field(..., description="Markdown-friendly reply for display.")
    data: dict[str, Any] = Field(default_factory=dict)
    actions: list[ChatActionLink] = Field(default_factory=list)
    escalation_reason: str | None = None

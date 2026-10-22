"""Lightweight intent classifier for the procurement chat.

Pure-Python keyword + regex matcher. No LLM call: the rest of the
pipeline already exercises the LLM in the comparator/recommender/
extractor agents, and the chat surface needs to stay deterministic and
fast (and to keep working when ``LLM_ENABLED=false`` per CLAUDE.md
"deterministic fallbacks so the demo always runs").

The classifier extracts:

* ``intent`` - which downstream operation to run
* ``request_id`` - matched against ``pr-XXX`` style ids
* ``department`` - Paraguayan department name (rough match)
* ``raw_quote_text`` - if the message looks like a pasted quotation
"""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass

from .schemas import ChatIntent

_REQUEST_ID_RE = re.compile(r"\b(pr[-_]?\d+[a-z0-9-]*)\b", re.IGNORECASE)
_QUOTATION_ID_RE = re.compile(r"\b(q[-_]?\d+[a-z0-9-]*)\b", re.IGNORECASE)
_UUID_RE = re.compile(
    r"\b([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\b",
    re.IGNORECASE,
)

_DEPARTMENTS = {
    "itapua",
    "alto parana",
    "caaguazu",
    "canindeyu",
    "san pedro",
    "concepcion",
    "amambay",
    "central",
    "paraguari",
    "guaira",
    "caazapa",
    "misiones",
    "neembucu",
    "cordillera",
    "presidente hayes",
    "boqueron",
    "alto paraguay",
}

_KEYWORDS: dict[ChatIntent, tuple[str, ...]] = {
    "compare_request": (
        "comparar",
        "comparacion",
        "compara",
        "compare",
        "comparison",
        "tabla comparativa",
    ),
    "recommend_request": (
        "recomienda",
        "recomendar",
        "recomendacion",
        "sugerir",
        "sugerencia",
        "mejor proveedor",
        "mejor oferta",
        "adjudicar",
        "adjudicacion",
        "decidir",
        "recommend",
        "suggest",
        "best supplier",
        "best offer",
    ),
    "extract_quotation": (
        "extraer",
        "extraccion",
        "cargar cotizacion",
        "parsear",
        "leer cotizacion",
        "ocr",
        "extract",
        "parse quote",
    ),
    "weather_forecast": (
        "clima",
        "tiempo",
        "lluvia",
        "lluvias",
        "pronostico",
        "pronostico climatico",
        "weather",
        "forecast",
        "rainfall",
    ),
    "fx_rate": (
        "tipo de cambio",
        "cambio",
        "cotizacion del dolar",
        "dolar",
        "guarani",
        "usd",
        "pyg",
        "fx",
        "exchange rate",
    ),
    "list_requests": (
        "listar solicitudes",
        "ver solicitudes",
        "solicitudes activas",
        "que solicitudes",
        "list requests",
        "open requests",
        "active requests",
    ),
    "list_suppliers": (
        "listar proveedores",
        "ver proveedores",
        "que proveedores",
        "list suppliers",
        "suppliers",
    ),
    "help": (
        "ayuda",
        "que puedes hacer",
        "que sabes hacer",
        "como funcionas",
        "help",
        "what can you do",
        "capabilities",
    ),
}


@dataclass
class Intent:
    """Outcome of intent classification."""

    intent: ChatIntent
    request_id: str | None = None
    quotation_id: str | None = None
    department: str | None = None
    raw_quote_text: str | None = None


def _strip_accents(text: str) -> str:
    return "".join(
        ch
        for ch in unicodedata.normalize("NFD", text)
        if unicodedata.category(ch) != "Mn"
    )


def _normalize(text: str) -> str:
    return _strip_accents(text).lower()


def _match_department(normalized: str) -> str | None:
    for dept in _DEPARTMENTS:
        if dept in normalized:
            return dept.title()
    return None


def _looks_like_pasted_quote(message: str) -> bool:
    """Heuristic: the message reads like a pasted email/quotation."""

    if len(message) < 220:
        return False
    lower = _normalize(message)
    money_signal = bool(re.search(r"\b\d[\d.,]{2,}\b", message))
    keyword_signal = any(
        token in lower
        for token in (
            "total",
            "cotizacion",
            "cotización",
            "factura",
            "iva",
            "plazo de entrega",
            "delivery",
            "garantia",
            "estimados",
            "ton",
            "kg",
        )
    )
    return money_signal and keyword_signal


def classify(message: str, *, fallback_request_id: str | None = None) -> Intent:
    """Return the most likely intent for ``message``."""

    normalized = _normalize(message)

    request_id = None
    uuid_match = _UUID_RE.search(message)
    if uuid_match:
        request_id = uuid_match.group(1).lower()
    else:
        request_match = _REQUEST_ID_RE.search(message)
        if request_match:
            request_id = request_match.group(1).lower().replace("_", "-")
        elif fallback_request_id:
            request_id = fallback_request_id

    quotation_id = None
    quotation_match = _QUOTATION_ID_RE.search(message)
    if quotation_match:
        quotation_id = quotation_match.group(1).lower().replace("_", "-")

    department = _match_department(normalized)

    # Order matters: compare wins over generic recommend wording when both
    # appear, because comparison is the cheaper deterministic operation.
    intent_order: tuple[ChatIntent, ...] = (
        "compare_request",
        "recommend_request",
        "extract_quotation",
        "weather_forecast",
        "fx_rate",
        "list_requests",
        "list_suppliers",
        "help",
    )
    chosen: ChatIntent = "unknown"
    for candidate in intent_order:
        if any(token in normalized for token in _KEYWORDS[candidate]):
            chosen = candidate
            break

    raw_quote_text: str | None = None
    if chosen == "unknown" and _looks_like_pasted_quote(message):
        chosen = "extract_quotation"
        raw_quote_text = message
    elif chosen == "extract_quotation":
        # Strip the trigger keyword if present, otherwise pass the message.
        raw_quote_text = message

    return Intent(
        intent=chosen,
        request_id=request_id,
        quotation_id=quotation_id,
        department=department,
        raw_quote_text=raw_quote_text,
    )

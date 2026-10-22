"""Chat orchestration: classify the user message, run the right agent.

The chat surface is intentionally a *thin* router on top of services
that already exist (``ProcurementOrchestrator``, ``ExtractorAgent``,
``WeatherService``, ``FXService``, ``ProcurementService``). It keeps
the LLM contracts and ML scoring pipeline as the single source of
truth for procurement intelligence; the chat just translates between
buyer prose and structured calls.
"""

from __future__ import annotations

import logging
from decimal import Decimal
from typing import Any

from agropredict.procurement.agents.extractor import ExtractorAgent
from agropredict.procurement.external.service import FXService, WeatherService
from agropredict.procurement.external.weather import UnknownDepartmentError
from agropredict.procurement.orchestrator import ProcurementOrchestrator
from agropredict.procurement.service import ProcurementService

from .intent import Intent, classify
from .schemas import ChatActionLink, ChatMessageResponse

logger = logging.getLogger(__name__)


_HELP_TEXT = (
    "Puedo ayudarte con tu flujo de compras. Probá pedirme:\n\n"
    "- **Comparar cotizaciones** -> `compara las cotizaciones` "
    "(usa la solicitud activa o pegá un id/UUID).\n"
    "- **Recomendar proveedor** -> `recomienda el mejor proveedor`\n"
    "- **Extraer cotizacion** -> pega el email/PDF en el mensaje y agregá `extraer`\n"
    "- **Pronostico de clima** -> `clima en Itapua para 10 dias`\n"
    "- **Tipo de cambio USD/PYG** -> `cotizacion del dolar`\n"
    "- **Listar solicitudes activas** -> `solicitudes activas`\n"
    "- **Listar proveedores** -> `proveedores`\n"
)


class ChatService:
    """Routes a free-text buyer message to the right procurement op."""

    def __init__(
        self,
        *,
        procurement: ProcurementService,
        orchestrator: ProcurementOrchestrator | None = None,
        extractor: ExtractorAgent | None = None,
        weather_service: WeatherService | None = None,
        fx_service: FXService | None = None,
    ) -> None:
        self._procurement = procurement
        self._orchestrator = orchestrator
        self._extractor = extractor
        self._weather = weather_service
        self._fx = fx_service

    # ------------------------------------------------------------------
    def handle(
        self,
        message: str,
        *,
        tenant_id: str,
        team_id: str | None = None,
        request_id_hint: str | None = None,
    ) -> ChatMessageResponse:
        intent = classify(message, fallback_request_id=request_id_hint)
        logger.info(
            "chat.intent_classified",
            extra={"intent": intent.intent, "tenant_id": tenant_id},
        )
        try:
            if intent.intent == "compare_request":
                return self._compare(intent, tenant_id=tenant_id)
            if intent.intent == "recommend_request":
                return self._recommend(intent, tenant_id=tenant_id)
            if intent.intent == "extract_quotation":
                return self._extract(intent, tenant_id=tenant_id)
            if intent.intent == "weather_forecast":
                return self._weather_forecast(intent)
            if intent.intent == "fx_rate":
                return self._fx_rate()
            if intent.intent == "list_requests":
                return self._list_requests(tenant_id=tenant_id, team_id=team_id)
            if intent.intent == "list_suppliers":
                return self._list_suppliers(tenant_id=tenant_id)
            if intent.intent == "help":
                return ChatMessageResponse(intent="help", reply=_HELP_TEXT)
            return ChatMessageResponse(
                intent="unknown",
                reply=(
                    "No entendi la consulta. " + _HELP_TEXT
                ),
            )
        except Exception as exc:  # noqa: BLE001 - chat must always answer
            logger.exception("chat.handle_failed: %s", exc)
            return ChatMessageResponse(
                intent=intent.intent,
                reply=(
                    "Tuve un problema procesando tu pedido. "
                    "Intentalo nuevamente o usa el menu lateral."
                ),
                escalation_reason="chat_handler_exception",
            )

    # ------------------------------------------------------------------
    def _resolve_request_id(
        self, intent: Intent, *, tenant_id: str
    ) -> tuple[str | None, str | None]:
        """Pick a request_id to operate on.

        Order:
        1. Use the explicit hint if it points at an existing request.
        2. Otherwise pick the most recent non-archived request for the tenant.
        3. Otherwise return ``(None, "no_requests_available")``.
        """
        if intent.request_id:
            existing = self._procurement.get_request(
                intent.request_id, tenant_id=tenant_id
            )
            if existing is not None:
                return existing.request_id, None
        all_requests = self._procurement.list_requests(tenant_id=tenant_id)
        if not all_requests:
            return None, "no_requests_available"
        # Prefer requests with at least one quotation, otherwise newest first.
        ranked = sorted(
            all_requests,
            key=lambda r: (
                getattr(r, "created_at", None) or "",
            ),
            reverse=True,
        )
        return ranked[0].request_id, None

    def _compare(self, intent: Intent, *, tenant_id: str) -> ChatMessageResponse:
        if self._orchestrator is None:
            return self._unsupported("comparator no esta habilitado en este deployment")
        request_id, miss = self._resolve_request_id(intent, tenant_id=tenant_id)
        if request_id is None:
            return ChatMessageResponse(
                intent="compare_request",
                reply=(
                    "No encuentro solicitudes en este tenant. "
                    "Cargá una desde 'Nueva solicitud' o corré el seed (`docker compose --profile seed run --rm seed`)."
                ),
                escalation_reason=miss,
            )
        result = self._orchestrator.recommend(request_id, tenant_id=tenant_id)
        comparison = result.comparison
        if comparison is None or not comparison.totals_by_supplier:
            return ChatMessageResponse(
                intent="compare_request",
                reply=(
                    f"No pude armar una comparacion para `{request_id}`. "
                    f"Motivo: {result.escalation_reason or 'sin cotizaciones suficientes'}."
                ),
                escalation_reason=result.escalation_reason,
                actions=_links_for_request(request_id),
            )

        lines = [
            f"### Comparacion de `{request_id}`",
            "",
            "| Proveedor | Total (PYG) | Plazo | Garantia |",
            "| --- | ---: | ---: | ---: |",
        ]
        for total in comparison.totals_by_supplier:
            lines.append(
                f"| {total.supplier_legal_name} "
                f"| {total.total_pyg:,.0f} "
                f"| {total.lead_time_days} dias "
                f"| {total.warranty_months or '-'} meses |"
            )
        best = comparison.best_in_criterion
        lines.append("")
        lines.append(
            f"**Mejor precio:** {best.price or '-'} - "
            f"**Mejor plazo:** {best.delivery or '-'} - "
            f"**Mejor garantia:** {best.warranty or '-'}"
        )
        if comparison.significant_differences:
            lines.append("")
            lines.append("**Diferencias significativas:**")
            for diff in comparison.significant_differences:
                lines.append(f"- {diff.criterion}: {diff.description}")

        return ChatMessageResponse(
            intent="compare_request",
            reply="\n".join(lines),
            data={
                "request_id": request_id,
                "comparison": comparison.model_dump(mode="json"),
                "score_count": len(result.scores),
            },
            actions=_links_for_request(request_id),
        )

    # ------------------------------------------------------------------
    def _recommend(self, intent: Intent, *, tenant_id: str) -> ChatMessageResponse:
        if self._orchestrator is None:
            return self._unsupported("recommender no esta habilitado en este deployment")
        request_id, miss = self._resolve_request_id(intent, tenant_id=tenant_id)
        if request_id is None:
            return ChatMessageResponse(
                intent="recommend_request",
                reply=(
                    "No encuentro solicitudes en este tenant. "
                    "Cargá una desde 'Nueva solicitud' o corré el seed (`docker compose --profile seed run --rm seed`)."
                ),
                escalation_reason=miss,
            )
        result = self._orchestrator.recommend(request_id, tenant_id=tenant_id)
        if result.status == "escalated" or result.recommendation is None:
            return ChatMessageResponse(
                intent="recommend_request",
                reply=(
                    f"La solicitud `{request_id}` se escalo: "
                    f"{result.escalation_reason or 'condicion no cumplida'}. "
                    "Cargá al menos 2 cotizaciones validadas e intentalo de nuevo."
                ),
                escalation_reason=result.escalation_reason,
                actions=_links_for_request(request_id),
            )
        rec = result.recommendation
        body = rec.reasoning_markdown or "(sin justificacion)"
        weather = result.weather_risk_score
        fx = result.fx_rate_usd_pyg
        signals: list[str] = []
        if weather is not None:
            signals.append(f"riesgo climatico {weather:.0f}/100")
        if fx is not None:
            signals.append(f"USD/PYG {fx:,.0f}")
        signals_md = (" - ".join(signals)) if signals else ""
        reply = (
            f"### Recomendacion para `{request_id}`\n"
            f"**Proveedor sugerido:** {rec.recommended_supplier_id} - "
            f"banda `{rec.decision_band}`\n"
            + (f"_Senales externas: {signals_md}_\n\n" if signals_md else "\n")
            + body
        )
        return ChatMessageResponse(
            intent="recommend_request",
            reply=reply,
            data={
                "request_id": request_id,
                "recommendation": rec.model_dump(mode="json"),
                "recommendation_id": result.recommendation_id,
                "weather_risk_score": _decimal_to_float(weather),
                "fx_rate_usd_pyg": _decimal_to_float(fx),
                "score_count": len(result.scores),
            },
            actions=_links_for_request(request_id),
        )

    # ------------------------------------------------------------------
    def _extract(self, intent: Intent, *, tenant_id: str) -> ChatMessageResponse:
        if self._extractor is None:
            return self._unsupported("extractor no esta habilitado en este deployment")
        text = (intent.raw_quote_text or "").strip()
        if not text:
            return ChatMessageResponse(
                intent="extract_quotation",
                reply=(
                    "Pega el cuerpo del email o el texto de la cotizacion en el "
                    "mensaje, junto con la palabra `extraer`."
                ),
            )
        request = None
        if intent.request_id:
            request = self._procurement.get_request(intent.request_id, tenant_id=tenant_id)
        extracted = self._extractor.extract(text, request=request)
        confidence = float(extracted.extraction_confidence)
        items_md = "\n".join(
            f"- {it.description} (cant. {it.quantity}): "
            f"{extracted.currency} {it.unit_price}"
            for it in extracted.items[:10]
        ) or "_(no se detectaron items)_"
        reply = (
            "### Cotizacion extraida\n"
            f"- **Total:** {extracted.currency} {extracted.total_amount:,.2f}\n"
            f"- **Plazo de entrega:** {extracted.lead_time_days} dias\n"
            f"- **Validez:** {extracted.validity_until_iso}\n"
            f"- **Confianza:** {confidence:.0%} "
            f"({extracted.extraction_source})\n\n"
            "**Items detectados:**\n"
            f"{items_md}\n\n"
            "Confirma estos datos antes de subirla con `Cargar cotizacion`."
        )
        actions = []
        if intent.request_id:
            actions.append(
                ChatActionLink(
                    label="Subir cotizacion",
                    href=f"/cargar?request_id={intent.request_id}",
                )
            )
        return ChatMessageResponse(
            intent="extract_quotation",
            reply=reply,
            data={"extracted": extracted.model_dump(mode="json")},
            actions=actions,
        )

    # ------------------------------------------------------------------
    def _weather_forecast(self, intent: Intent) -> ChatMessageResponse:
        if self._weather is None:
            return self._unsupported("servicio de clima no esta habilitado")
        department = intent.department or "Itapua"
        try:
            snap = self._weather.get_or_fetch(department=department, horizon_days=10)
        except UnknownDepartmentError as exc:
            return ChatMessageResponse(
                intent="weather_forecast",
                reply=f"No reconozco el departamento solicitado: {exc}",
            )
        except Exception as exc:  # noqa: BLE001
            return ChatMessageResponse(
                intent="weather_forecast",
                reply=f"El proveedor de clima no respondio: {exc}",
                escalation_reason="weather_provider_unavailable",
            )
        comp = snap.components
        reply = (
            f"### Pronostico para {snap.department}\n"
            f"- **Riesgo climatico:** {snap.weather_risk_score:.0f}/100 "
            f"(banda `{snap.risk_band}`)\n"
            f"- **Horizonte:** {snap.horizon_days} dias\n"
            + (
                f"- **Lluvia acumulada:** {comp.precipitation_sum_mm} mm\n"
                if comp.precipitation_sum_mm is not None
                else ""
            )
            + (
                f"- **Dias con stress termico:** {comp.heat_stress_days}\n"
                if comp.heat_stress_days is not None
                else ""
            )
            + (snap.interpretation or "")
        )
        return ChatMessageResponse(
            intent="weather_forecast",
            reply=reply,
            data={"weather": snap.model_dump(mode="json")},
        )

    # ------------------------------------------------------------------
    def _fx_rate(self) -> ChatMessageResponse:
        if self._fx is None:
            return self._unsupported("servicio de tipo de cambio no esta habilitado")
        rate = self._fx.get_or_fetch(base="USD", quote="PYG")
        reply = (
            f"### Tipo de cambio USD/PYG\n"
            f"- **Referencia:** {rate.rate_reference:,.2f} Gs\n"
            + (
                f"- **Compra:** {rate.rate_buy:,.2f} Gs\n"
                if rate.rate_buy is not None
                else ""
            )
            + (
                f"- **Venta:** {rate.rate_sell:,.2f} Gs\n"
                if rate.rate_sell is not None
                else ""
            )
            + f"- **Fuente:** {rate.source}"
        )
        return ChatMessageResponse(
            intent="fx_rate",
            reply=reply,
            data={"fx": rate.model_dump(mode="json")},
        )

    # ------------------------------------------------------------------
    def _list_requests(
        self, *, tenant_id: str, team_id: str | None
    ) -> ChatMessageResponse:
        requests = self._procurement.list_requests(
            tenant_id=tenant_id, team_id=team_id
        )
        if not requests:
            return ChatMessageResponse(
                intent="list_requests",
                reply="No hay solicitudes registradas todavia para tu equipo.",
            )
        lines = ["### Solicitudes activas", "", "| ID | Titulo | Estado | Urgencia |", "| --- | --- | --- | --- |"]
        for req in requests[:25]:
            status = getattr(req.status, "value", str(req.status))
            urgency = getattr(req.urgency, "value", str(req.urgency))
            lines.append(
                f"| `{req.request_id}` | {req.title} | {status} | {urgency} |"
            )
        return ChatMessageResponse(
            intent="list_requests",
            reply="\n".join(lines),
            data={"count": len(requests)},
            actions=[ChatActionLink(label="Ver inbox", href="/")],
        )

    def _list_suppliers(self, *, tenant_id: str) -> ChatMessageResponse:
        suppliers = self._procurement.list_suppliers(tenant_id=tenant_id)
        if not suppliers:
            return ChatMessageResponse(
                intent="list_suppliers",
                reply="Aun no hay proveedores cargados para este tenant.",
            )
        lines = [
            "### Proveedores",
            "",
            "| RUC | Razon social | Pais |",
            "| --- | --- | --- |",
        ]
        for sup in suppliers[:25]:
            lines.append(f"| {sup.ruc} | {sup.legal_name} | {sup.country} |")
        return ChatMessageResponse(
            intent="list_suppliers",
            reply="\n".join(lines),
            data={"count": len(suppliers)},
            actions=[ChatActionLink(label="Ver proveedores", href="/proveedores")],
        )

    # ------------------------------------------------------------------
    @staticmethod
    def _unsupported(reason: str) -> ChatMessageResponse:
        return ChatMessageResponse(
            intent="unknown",
            reply=f"No puedo atender ese pedido ahora mismo: {reason}.",
            escalation_reason=reason,
        )


def _links_for_request(request_id: str) -> list[ChatActionLink]:
    return [
        ChatActionLink(label="Abrir solicitud", href=f"/solicitud/{request_id}"),
        ChatActionLink(label="Comparar y recomendar", href=f"/comparar/{request_id}"),
    ]


def _decimal_to_float(value: Decimal | None) -> float | None:
    return float(value) if value is not None else None


def _resolve_data(payload: Any) -> dict[str, Any]:  # pragma: no cover - safety
    if hasattr(payload, "model_dump"):
        return payload.model_dump(mode="json")
    if isinstance(payload, dict):
        return payload
    return {}

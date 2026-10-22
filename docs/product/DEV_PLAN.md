# AgroBuy - Plan de Desarrollo Ejecutable

> Documento operativo. Define qué se reutiliza del repo `agro-predict-ai-main`, qué se construye nuevo, en qué orden, y con qué cortes de alcance. Es el plan que vamos a seguir paso a paso.
>
> Plan de producto: `compras/COMPRAS_AGRO_plan.md` (vinculante).
> Fundamentación scoring climático: `agro_procurement_weather_scoring.md`.
> Repo base: `agro-predict-ai-main/`.

---

## 1. Decisiones arquitectónicas (fijas)

1. **El repo `agro-predict-ai-main` se usa como base** del backend. No se reescribe la plataforma.
2. **Frontend del repo (Vite/React) se trata como "operator console"**, no como UI del comprador. La UI del comprador es la APEX app empaquetada (spec 021). Si hace falta una UI rápida adicional para demo, se genera con Lovable apuntando a los mismos endpoints REST.
3. **Los 4 agentes de procurement son módulo nuevo**, no extensión del `PredictionGraph` agronómico existente. Ambos grafos conviven.
4. **El Oracle APEX adapter existente se reutiliza tal cual** para read-only ingestion + write-back auditado.
5. **SpecKit en modo ligero**: cerramos `plan.md` cortos para specs 018-021 (no escribimos `tasks.md` largos). TDD selectivo: tests donde el costo de bug es alto (extractor JSON, normalización de moneda, gate de calidad), no en todo.
6. **Constitution Check en cada PR pero pragmático**: respetamos los Tier 1 (data quality gate, audit, tenant isolation, observabilidad). No nos auto-bloqueamos en Tier 2 (i18n, A11y full WCAG, deep learning adapters).
7. **Sin Kubernetes / Helm / air-gapped en el camino crítico del hackatón**. Mantenemos las migraciones alembic y la disciplina de Postgres, pero el deploy de demo va a un Compute simple (OCI free tier o Render).

---

## 2. Reuse map (archivo por archivo)

### Reutilizamos tal cual (no tocar)

| Path | Por qué |
|---|---|
| `backend/src/backend/llm/` | Adapter LLM + circuit breaker + flag `LLM_ENABLED` |
| `backend/src/backend/integrations/oracle_apex/` | APEX adapter read-only + write-back auditado |
| `backend/src/backend/predictions/agent_execution_repository.py` | Audit trail de ejecuciones de agentes |
| `backend/src/backend/queue/` + `worker.py` | ARQ worker pipeline |
| `backend/src/backend/persistence/` | Conexion Postgres, RLS, sesiones |
| `backend/src/backend/security/` + `credentials/` + `tenancy/` | Tenant scoping, secrets, multi-tenant base |
| `backend/src/backend/observability/` | Logs estructurados, metrics, traces |
| `backend/alembic/` + `alembic.ini` | Migration runner |
| `backend/src/backend/app.py` | FastAPI app entrypoint (extendemos, no reescribimos) |
| `docker-compose.yml`, `Makefile` | Local dev (Postgres + Redis + ARQ) |

### Extendemos (escribimos nuevo encima)

| Path | Acción |
|---|---|
| `backend/src/backend/app.py` | Registrar el router nuevo `procurement/api.py` |
| `backend/alembic/versions/` | Agregar migraciones nuevas (0022+, ver fase 1) |
| `specs/018-procurement-domain/` | Cerrar `plan.md` corto |
| `specs/019-procurement-decision-pipeline/` | Cerrar `plan.md` corto |
| `specs/020-procurement-negotiation-assistant/` | Cerrar `plan.md` corto |
| `specs/021-procurement-apex-application/` | Cerrar `plan.md` corto |

### Ignoramos para el hackatón (no remover, no tocar)

| Path | Razón |
|---|---|
| `backend/src/backend/predictions/agents/*` (los 5 agentes agronómicos) | Dominio diferente. Conviven sin estorbar. |
| `backend/src/backend/predictions/graph.py` (PredictionGraph corn) | Lo dejamos andando; no lo invocamos desde procurement. |
| `backend/models/corn_rf_v1.0.0_*.joblib` | Modelo agronómico, irrelevante. |
| `helm/`, `k8s/` | No se deploya en K8s para la demo. |
| `frontend/` (Vite/React operator UI) | Queda como operator console. Demo del comprador va por APEX (+ Lovable opcional). |
| `specs/001-015` | Ya implementadas. No tocar. |

### Nuevo (lo construimos)

```
backend/src/backend/procurement/
├── __init__.py
├── api.py                  # FastAPI router: /procurement/*
├── models.py               # Pydantic: PurchaseRequest, Supplier, Quotation, RecommendedOffer, NegotiationMessage
├── repository.py           # SQLAlchemy access layer + tenant scoping
├── service.py              # Orquesta agentes y reglas de transicion
├── data_quality_gate.py    # Validaciones spec 018 (validity, currency, units, etc.)
├── scoring/
│   ├── __init__.py
│   ├── urgency.py          # Urgency Score (weather + delivery + volatility)
│   ├── offer.py            # Offer Score (supplier ML + terms + delivery risk)
│   └── decision_matrix.py  # Matriz Urgency x Offer -> recomendacion textual
├── agents/
│   ├── __init__.py
│   ├── extractor.py        # LLM #1: PDF/imagen/texto -> JSON estructurado
│   ├── comparator.py       # LLM #2: N cotizaciones -> tabla normalizada
│   ├── recommender.py      # LLM #3: comparison + scores -> recomendacion markdown
│   └── negotiator.py       # LLM #4: cotizacion + brechas -> email
├── graph.py                # ProcurementGraph (LangGraph, paralelo al PredictionGraph)
├── ml/
│   ├── supplier_predictor.py  # XGBoost cumplimiento proveedor
│   └── anomaly_detector.py    # Z-score precios por categoria
├── external/
│   ├── weather.py          # Open-Meteo + cache en weather_snapshots
│   └── fx.py               # BCP USD/PYG + cache en fx_rates
└── fixtures/
    ├── suppliers_agro.csv
    ├── agro_catalog.csv
    ├── supplier_performance_history.csv
    └── sample_quotations/  # PDFs/imagenes/textos demo
```

---

## 3. Plan de fases

Cada fase tiene salida funcional: si paramos ahi, el demo sigue mostrando algo.

### Fase 0 - Bootstrap (30-45 min)

**Salida:** repo levantado local, base lista para escribir codigo.

- `make local-up` (Postgres + Redis + worker)
- `uv sync --project backend --dev`
- Crear branch `022-procurement-implementation`
- Crear directorio `backend/src/backend/procurement/` con `__init__.py` vacio
- Health check: `curl localhost:8000/healthz` devuelve `database/redis configured: true`
- Verificar que `pytest` corre limpio sobre el repo intacto

**Verificacion:** los tests existentes siguen verdes despues del scaffolding vacio.

---

### Fase 1 - Domain layer (spec 018) (2-3 h)

**Salida:** API REST que crea/lee purchase requests, suppliers, quotations con tenant scoping y data quality gate.

1. Migration alembic `0022_procurement_domain.py`:
   - `purchase_requests` (con campos agro: target_crop, target_zafra, fenological_window, delivery_department, target_hectares)
   - `suppliers` (con campos agro: is_importer, senave_registered, iso_certified, primary_origin_countries)
   - `quotations` (con campos agro: incoterm, currency, exchange_rate_quoted, anomaly_score)
   - `quotation_items`
   - `procurement_audit_events`
   - `agro_catalog`
   - RLS policies por `tenant_id`
2. `procurement/models.py`: Pydantic schemas alineados con migration.
3. `procurement/repository.py`: CRUD con tenant scope obligatorio.
4. `procurement/data_quality_gate.py`: validity_window, currency_supported, lead_time plausible, unit_consistency.
5. `procurement/api.py`:
   - `POST /api/v1/procurement/requests`
   - `GET /api/v1/procurement/requests/{id}`
   - `POST /api/v1/procurement/suppliers`
   - `POST /api/v1/procurement/quotations` (corre data quality gate)
   - `GET /api/v1/procurement/requests/{id}/quotations`
6. Tests minimos:
   - `test_purchase_request_creation_scoped_by_tenant`
   - `test_quotation_quarantined_on_expired_validity`
   - `test_cross_tenant_returns_404`

**Plan de spec 018:** escribir `specs/018-procurement-domain/plan.md` (1 pagina) que apunte a esta fase y pase Constitution Check.

---

### Fase 2 - External signals layer (1.5-2 h)

**Salida:** endpoints `/weather/risk` y `/fx/usd_pyg` funcionando con cache en DB.

1. Migration `0023_procurement_external_signals.py`: tablas `weather_snapshots`, `fx_rates`, `procurement_scores`.
2. `procurement/external/weather.py`:
   - Mapping de 17 departamentos PY a coordenadas (constante en codigo).
   - Cliente Open-Meteo con timeout 5s, fallback ECMWF, cache 6h.
   - Calcula composite weather_risk_score (0-100) segun bandas del plan.
3. `procurement/external/fx.py`: cliente BCP con cache 1h y fallback fijo.
4. `procurement/api.py`:
   - `GET /api/v1/procurement/weather/risk?department=Itapua&horizon_days=10`
   - `GET /api/v1/procurement/fx/usd_pyg`
5. Tests con responses mockeados (sin red en CI).

**Decision de scope:** market_volatility_proxy del Urgency Score se queda como **valor configurable manual (low/medium/high)** en el MVP. No salimos a ningun feed de commodities.

---

### Fase 3 - Scoring + ML (2-3 h)

**Salida:** Urgency Score, Offer Score, matriz de decision y predicciones ML cacheadas.

1. `procurement/ml/supplier_predictor.py`:
   - Entrenamiento offline con `fixtures/supplier_performance_history.csv` (sintetico calibrado).
   - Modelo XGBoost binario + regresion de delay.
   - Persistir `.joblib` en `backend/models/supplier_predictor_v1.joblib`.
   - Inferencia con cache en tabla `supplier_predictions` existente o nueva.
2. `procurement/ml/anomaly_detector.py`:
   - Z-score por categoria contra rangos de mercado del `agro_catalog`.
   - No requiere training - es estadistica simple.
3. `procurement/scoring/urgency.py`:
   - Input: weather_risk + stock_days + volatility_proxy.
   - Pesos del plan (0.45 / 0.40 / 0.15).
4. `procurement/scoring/offer.py`:
   - Input: supplier_score (ML) + commercial_terms + delivery_risk (ML + anomaly).
   - Pesos del plan (0.35 / 0.40 / 0.25).
5. `procurement/scoring/decision_matrix.py`: tabla discreta del plan.
6. Tests sobre los 3 scoring puros (deterministas, sin LLM).

**Verificacion:** dado un fixture con 4 cotizaciones, los scores son estables y la matriz devuelve la decision esperada.

---

### Fase 4 - Agentes LLM (3-4 h)

**Salida:** los 4 agentes corriendo con `LLM_ENABLED=true`, con fallback determinista cuando esta `false`.

1. `procurement/agents/extractor.py`:
   - Input: archivo (PDF/imagen) + request_context.
   - PDF: `pypdf` + vision si tablas rotas.
   - Output: `QuotationStructured` (Pydantic strict).
   - Prompt: del COMPRAS_AGRO_plan section 4.1 #1.
   - Fallback: parser regex minimo para totales y plazos.
2. `procurement/agents/comparator.py`:
   - Input: N quotations validadas + request.
   - Usa FX para normalizar a PYG con IVA + envio.
   - Output: tabla normalizada estructurada.
3. `procurement/agents/recommender.py`:
   - Input: comparison + scores duales + ML predictions + anomalias.
   - **El LLM no calcula scores** - solo articula los ya calculados (regla critica del plan).
   - Output: markdown con justificacion + alternativas + riesgos + accion sugerida.
4. `procurement/agents/negotiator.py`:
   - Input: cotizacion seleccionada + best_alternative + target_improvements + tono.
   - Output: email texto plano agro PY.
5. Cada agente reusa `backend/src/backend/llm/adapter.py` con su circuit breaker.
6. Cada agente registra ejecucion en `agent_execution_repository`.

**Tests:** sobre cada prompt, contract test con response mockeado del LLM. Smoke test e2e con LLM real solo en pre-demo.

---

### Fase 5 - ProcurementGraph + service (1-2 h)

**Salida:** un solo endpoint `POST /api/v1/procurement/requests/{id}/recommend` orquesta todo.

1. `procurement/graph.py`: LangGraph StateGraph con nodos:
   ```
   load_quotations -> data_quality_gate -> compute_scores -> compare (LLM) -> recommend (LLM) -> review -> persist
   ```
   - Reusar el patron de checkpointing de `predictions/graph.py`.
   - Cada falla termina en estado `escalated` con `escalation_reason`.
2. `procurement/service.py`: facade que dispara el graph y devuelve `RecommendedOffer`.
3. `procurement/api.py`:
   - `POST /api/v1/procurement/requests/{id}/recommend` (sincrono para demo, async via ARQ opcional)
   - `POST /api/v1/procurement/quotations/{id}/extract` (corre extractor agent)
   - `POST /api/v1/procurement/quotations/{id}/negotiate` (corre negotiator agent)
4. Health: extender `/healthz` para incluir `procurement_graph` ready.

**Plan de specs 019 + 020:** escribir `plan.md` cortos en cada uno apuntando a esta fase.

---

### Fase 6 - APEX app + write-back (3-4 h)

**Salida:** APEX app empaquetada que cubre el demo arc del plan.

1. Crear workspace en `apex.oracle.com` (pre-trabajo, ya en checklist del plan).
2. Tablas APEX para purchase_requests / suppliers / quotations (mirror del schema Postgres pero en Oracle).
3. Paginas APEX (orden de prioridad para demo):
   - **P1** Login mock con selector de rol cooperativa.
   - **P2** Cola de solicitudes (Interactive Report).
   - **P3** Crear solicitud agro (form + master-detail items).
   - **P4** Detalle solicitud + cotizaciones.
   - **P5** Cargar cotizacion (file upload + REST call al extractor).
   - **P6** Comparar / Recomendar / Negociar (la pagina estrella).
   - P7 Catalogo proveedores agro (si hay tiempo).
   - P8 Dashboard ejecutivo (si hay tiempo).
4. REST Data Sources de APEX apuntando a los endpoints de Fase 5.
5. Write-back: el backend escribe la recomendacion en la tabla APEX `recommendations` via el adapter existente.
6. Export `.sql` a `operations/apex/agrobuy_app.sql`.

**Plan de spec 021:** escribir `plan.md` apuntando a esta fase.

**Fallback critico:** si una pagina APEX no compila, tener pre-cargada la version equivalente en Lovable como Plan B (no main, pero salvavidas).

---

### Fase 7 - Fixtures, demo data, ensayo (2 h)

**Salida:** demo end-to-end funcionando con datos calibrados.

1. Cargar 12 proveedores agro PY (con RUC sinteticos).
2. Cargar `supplier_performance_history.csv` con 500 entregas distribuidas (top/mid/bottom quartiles).
3. Cargar 10 solicitudes demo + 30 cotizaciones (algunas con anomalia deliberada).
4. Tener listos 5 PDFs/imagenes de cotizacion para el demo del extractor.
5. Pre-calentar LLM con call dummy.
6. Grabar video de respaldo del demo (Plan B si falla la conectividad).
7. Ensayar el demo arc del plan section 10 al menos 2 veces.

---

## 4. Anti-objetivos (lo que NO hacemos)

- No tocamos los 5 agentes agronomicos existentes ni su pipeline.
- No deployamos en K8s. OCI Compute o Render.
- No implementamos i18n full ni A11y WCAG completo (solo el subset no-negociable: keyboard, contrast, no color-only).
- No abrimos un nuevo datastore - todo en Postgres.
- No tocamos el frontend Vite/React (queda como operator console).
- No implementamos market_volatility en vivo - es manual.
- No conectamos a feeds reales de commodities (FAO, CME).
- No implementamos sub-estacional ni estacional weather - solo 7-10 dias.
- No escribimos tasks.md largos para specs 018-021 - solo plan.md cortos.

---

## 5. Contratos minimos para que la API y la APEX se entiendan

```
POST /api/v1/procurement/requests
  body: { tenant_id, team_id, title, target_crop, target_zafra, hectares,
          delivery_department, criteria_weights, deadline_date, items[] }
  -> 201 { request_id, status: "draft" }

POST /api/v1/procurement/suppliers
  body: { tenant_id, ruc, legal_name, primary_categories, ... }
  -> 201 { supplier_id }

POST /api/v1/procurement/quotations
  body: { request_id, supplier_id, total_amount, currency, lead_time_days,
          validity_until, items[], raw_file_url? }
  -> 201 { quotation_id, status: "validated" | "quarantined", quality_flags[] }

POST /api/v1/procurement/quotations/{id}/extract
  multipart: file + supplier_hint?
  -> 200 QuotationStructured (preview, no persiste hasta confirmar)

POST /api/v1/procurement/requests/{id}/recommend
  body: { custom_weights? }
  -> 200 {
       recommended_quotation_id,
       composite_score,
       urgency_score, offer_score, decision_band,
       reasoning_markdown,
       alternatives_considered[],
       risks_identified[],
       provenance_chain[]
     }

POST /api/v1/procurement/quotations/{id}/negotiate
  body: { target_improvements: { price_pct?, lead_time_days? }, tone }
  -> 200 { message_text, generated_at }

GET  /api/v1/procurement/weather/risk?department=Itapua&horizon_days=10
GET  /api/v1/procurement/fx/usd_pyg
```

---

## 6. Demo arc minimo (lo que TIENE que funcionar)

Si todo lo demas falla, el demo va sobre estos 90 segundos:

1. Login en APEX como Comprador de Cooperativa Coopagro.
2. Abrir solicitud "Urea para zafra soja 26/27".
3. Cargar PDF de cotizacion -> agente extractor devuelve JSON estructurado.
4. Click "Comparar" -> tabla normalizada con FX aplicado.
5. Click "Generar recomendacion" -> markdown con scores duales + justificacion + anomaly detection citada.
6. Click "Generar mensaje de negociacion" -> email tono agro PY.
7. Cierre: "4 agentes LLM + ML predictivo + scoring climatico, todo sobre APEX, base 100% open source."

Si esto funciona end-to-end, estamos en top 3.

---

## 7. Checklist de progreso

Marcar conforme se completa.

- [ ] Fase 0 - Bootstrap
- [ ] Fase 1 - Domain layer (spec 018 + plan.md)
- [ ] Fase 2 - External signals (weather + FX)
- [ ] Fase 3 - Scoring + ML
- [ ] Fase 4 - Agentes LLM
- [ ] Fase 5 - ProcurementGraph + service (specs 019 + 020 + plan.md)
- [ ] Fase 6 - APEX app (spec 021 + plan.md + .sql export)
- [ ] Fase 7 - Fixtures + ensayo + video respaldo

---

## 8. Punto de arranque

**Siguiente paso concreto:** Fase 0. Levantar el repo local, branch nueva, scaffold del modulo `procurement/`, verificar que los tests existentes siguen verdes.

Cuando este verde, arrancamos Fase 1 con la migration alembic 0022.

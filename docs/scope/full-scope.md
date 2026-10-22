# AgroBuy — Full Scope (visión consolidada A + B)


---

## 1. Qué es AgroBuy

AgroBuy es una **plataforma de inteligencia predictiva y operativa para el agro paraguayo**, con dos superficies de producto que comparten dominio, filosofía y plataforma técnica:

- **Producto A — AgroBuy MVP (compras):** copiloto de compras (procurement) para cooperativas agropecuarias. Es lo que corre hoy y lo que se demostró en el hackatón.
- **Producto B — AgroBuy real (plataforma predictiva):** sistema multi-agente de predicción agronómica y logística, self-hosted, enterprise-grade, con consola de operador, governance y devops completo.

**La dirección final es A + B convergiendo**, no uno reemplazando al otro. A es el MVP que funciona; B es hacia dónde converge el producto. Ambos nacen del mismo repo: B es la base, A es la capa de producto que se montó encima para el hackatón (specs 018-021 del roadmap de B). Ver el detalle verificado byte a byte en [../development/plans/product-separation.md](../development/plans/product-separation.md).

| | Producto A — AgroBuy MVP | Producto B — AgroBuy real |
|---|---|---|
| Qué es | Copiloto de compras agro | Plataforma multi-agente de predicción + devops enterprise |
| Pipeline IA | Orquestador vanilla lineal, 4 agentes LLM | LangGraph StateGraph, 5 agentes con guards |
| Estado | Activo en front y back; demostrado | Backend vivo pero silenciado; consola desconectada; devops archivado |
| Specs | 018-021 | 001-017 |
| Madurez | MVP funcional | Visión completa, parcialmente implementada |

---

## 2. Caso de uso ancla

- **Tenant**: Cooperativa Coopagro (Itapúa, Paraguay), campaña 2026/27.
- **Usuario**: Ana Rojas, analista de compras (`comprador@coopagro.coop.py`).
- **Compra demo**: 800 ton de urea 46% para la zafra de soja 26/27, con cotizaciones de Proveedor Agro 1, Proveedor Agro 4, Proveedor Agro 2 y Proveedor Agro 3.
- **Decisión asistida**: comparar cotizaciones normalizadas, recibir una recomendación justificada por IA y generar el mensaje de negociación, todo grounded en datos reales de proveedores, clima y tipo de cambio.

---

## 3. Producto A — AgroBuy MVP (compras)

### 3.1 Propósito

Copiloto que permite a un comprador de cooperativa registrar solicitudes, cargar cotizaciones (texto; la carga de archivos es un placeholder), comparar alternativas normalizadas, recibir una recomendación justificada por IA y generar mensajes de negociación. Verticaliza el desafío oficial del hackatón ("Copiloto Inteligente de Compras") al sector cooperativas agro PY.

### 3.2 Pipeline de decisión

Secuencia Python lineal (no LangGraph), end-to-end:

```
load -> ML supplier predictor -> anomaly detection -> dual scoring -> compare (LLM) -> recommend (LLM) -> persist
```

### 3.3 Componentes de IA y ML

1. **4 agentes LLM especializados**, todos con **fallback determinístico** (el demo corre aunque no haya LLM):
   - `extractor` — texto crudo de cotización -> JSON estructurado.
   - `comparator` — N cotizaciones -> comparativa normalizada.
   - `recommender` — comparativa + scores -> recomendación en markdown con citas.
   - `negotiator` — cotización + brechas -> email de negociación (tono agro PY, español).
2. **ML supplier predictor real**: `GradientBoostingClassifier`, AUC 0.748 sobre 329 muestras sintéticas calibradas, 9 features por proveedor, con fallback por reglas. Predice probabilidad de cumplimiento (`p_on_time`).
3. **Anomaly detection**: chequeo de rango de precios contra las bandas del catálogo agro PY (el z-score queda para cuando haya historial real).
4. **Dual scoring explicable** con matriz de decisión:
   - Urgency = 0.45 weather + 0.40 stock/delivery + 0.15 volatility.
   - Offer = 0.35 supplier ML + 0.40 terms + 0.25 (100 - delivery risk).

### 3.4 Señales externas en vivo

- **Open-Meteo**: riesgo climático 0-100 por departamento PY (17 departamentos mapeados a coordenadas), cache 6h.
- **FX USD/PYG**: tipo de cambio del día (open.er-api.com), cache 1h con fallback configurable.

### 3.5 Superficies de cliente

API-first bajo `/api/v1/procurement/*`, consumida por dos clientes intercambiables:

- **React 19**: Vite, TanStack Router (file-based) + Query, Tailwind v4, shadcn/Radix UI, Recharts, Lucide.
- **Oracle APEX**: app low-code consumiendo los mismos REST Data Sources (build guide en `docs/development/apex/`).

### 3.6 Páginas del comprador

1. **Inbox** — solicitudes activas con filtros y KPI strip.
2. **Nueva solicitud** — datos generales, contexto agro, plazo/presupuesto, pesos de evaluación e ítems.
3. **Detalle de solicitud** — solicitud + cotizaciones recibidas + acciones.
4. **Cargar cotización** — tabs texto/archivo, extracción IA con pre-fill editable.
5. **Comparar y recomendar** (página estrella) — tabla normalizada, recomendación con composite score y dual scoring, generador de mensaje de negociación.
6. **Catálogo de proveedores** — cards con ML `p_on_time`, `on_time_rate` histórico y drill-down de performance.
7. **Dashboard ejecutivo** — KPIs, gasto mensual, gasto por categoría, tops de proveedores, alertas de anomalías.

### 3.7 Endpoints clave

| Método | Path | Descripción |
|---|---|---|
| `GET` | `/api/v1/procurement/requests` | Listar solicitudes del tenant/team |
| `POST` | `/api/v1/procurement/requests` | Crear solicitud |
| `GET` | `/api/v1/procurement/requests/{id}/quotations` | Cotizaciones de la solicitud |
| `POST` | `/api/v1/procurement/quotations/extract` | LLM extractor (texto crudo -> JSON) |
| `POST` | `/api/v1/procurement/requests/{id}/recommend` | Pipeline end-to-end |
| `POST` | `/api/v1/procurement/quotations/{id}/negotiate` | LLM negotiator (email tono agro PY) |
| `GET` | `/api/v1/procurement/weather/risk` | Riesgo climático por departamento |
| `GET` | `/api/v1/procurement/fx/usd_pyg` | Tipo de cambio del día |
| `GET` | `/api/v1/procurement/suppliers` | Catálogo de proveedores |

### 3.8 Datos demo y estado

- Fixtures: 8 proveedores agro PY, 6 ítems de catálogo, 5 solicitudes, 15 cotizaciones, 157 deliveries históricos.
- 62/62 tests de procurement verdes (528 tests totales en backend), lint clean, smoke E2E contra Postgres + Open-Meteo + FX en vivo.

---

## 4. Producto B — AgroBuy real (plataforma predictiva multi-agente)

### 4.1 Propósito

Sistema multi-agente de inteligencia predictiva self-hosted para agricultura y logística, que corre **dentro de la infraestructura del cliente** (Kubernetes propio), con aislamiento por tenant y equipo, escalado horizontal, auditabilidad y observabilidad production-grade. Sin SaaS operado por el vendor, sin data plane cross-customer. Perfiles connected y air-gapped son ambos de primera clase.

### 4.2 Pipeline de predicción (LangGraph)

Un evento de ingesta dispara el grafo. LangGraph orquesta cinco agentes en secuencia, cada paso guardado:

```
data_analyst -> ml_executor -> recommendation_engine -> explainability -> reviewer
```

Ninguna predicción llega a producción salvo que: pasen los data quality gates, el modelo ejecute, se complete la verificación de explicabilidad y el reviewer apruebe. Cualquier falla se enruta a un escalation sink registrado en vez de continuar en silencio.

### 4.3 Otras pipelines

- **Model pipeline**: data validation -> feature engineering -> training -> accuracy validation -> deploy en shadow-mode -> runtime activo.
- **Config pipeline**: admin UI o API -> config versionada en PostgreSQL -> validación shadow-mode -> runtime activo.

### 4.4 Frontend operator console

Consola de operador (hoy desconectada en el repo, revivible) con tabs: dashboard, control-room, interrupts, graph-editor, flow-simulator, predictions, tenant-admin. Incluye un "pixel office" con sprites de agentes.

### 4.5 Capa enterprise / governance

Billing y metering, compliance (data retention, DPA gate), rotación de credenciales con SLA, disaster recovery (RPO/RTO), SLOs y burn-rate alerting, status page público, runbooks de incidentes, supply-chain hardening.

### 4.6 Tier 1 non-negotiables (constitución del producto B)

Estas reglas son la "constitución" del producto completo (ver `archive/.specify/memory/constitution.md`). Resumen:

- Toda predicción grounded en fuentes verificables con cadena de provenance.
- Cada agente emite logs/metrics/traces; predicciones con artefactos de explicación.
- Test-first obligatorio (agentes, modelos, integraciones); sin merge sin tests verdes.
- Degradación grácil ante fallas parciales; fallback a modelo cacheado con warning de staleness.
- Comunicación entre agentes solo por estado LangGraph (sin llamadas API directas inter-agente).
- Artefactos de modelo versionados (fecha de training, hash del dataset, métricas).
- Integraciones externas con circuit breaker; Oracle APEX read-only salvo write-back auditado.
- Frontend consume solo vía API (sin acceso directo a DB).
- Connected y air-gapped ambos obligatorios.
- Multi-tenancy con aislamiento de credenciales, datos, modelos, budgets y cola.
- Config en PostgreSQL versionada, auditable, rollbackable, con shadow-mode.
- Migraciones expand/contract con tests de reversibilidad.
- Feature-flag kill switches para capacidades de alto riesgo.
- Despliegue K8s-native (Helm, HPA, health probes, quotas).
- Rate limiting y weighted-fair queueing; dead letter queue; graceful shutdown a checkpoints.

### 4.7 Tier 2 (degradación permitida)

Editor visual de grafo (target CRUD completo; degradación: visualización read-only + import/export JSON), i18n español (degradación: inglés con infra de extracción lista), WCAG 2.1 AA (subset no-negociable: sin estado por color, navegable por teclado, `prefers-reduced-motion`, contraste AA), adapters de deep learning (degradación: scikit-learn con interfaz lista), streaming de sensores (degradación: batch polling), RAG opcional vía `pgvector` (puede quedar deshabilitado).

---

## 5. Plataforma compartida (de A y B)

Infraestructura transversal que ambos productos importan y nunca duplican:

| Capa | Rol |
|---|---|
| `persistence` | PostgreSQL 16 async, RLS por tenant, sesiones, migraciones Alembic |
| `security` | auth, JWT, encryption (Fernet/envelope) |
| `credentials` | secrets, KMS, rotación |
| `tenancy` | scoping multi-tenant (teams/BU/proyectos dentro de un cliente) |
| `observability` | logs estructurados, métricas Prometheus, traces OTel |
| `queue` | ARQ + Redis, worker, circuit breaker state, DLQ |
| `webhook` | ingesta webhook firmada (HMAC-SHA256) |
| `llm` | adapter LLM multi-provider + circuit breaker + fallback |
| `integrations` | Oracle APEX (read-only + write-back auditado), GitHub |
| `config` | Pydantic Settings |
| `testing` | helpers de test compartidos |

---

## 6. Stack técnico completo

| Capa | Tecnología |
|---|---|
| Orquestación | LangGraph StateGraph (B), orquestador vanilla (A); `langgraph-checkpoint-postgres` |
| API y workers | FastAPI, ARQ |
| ML | scikit-learn (`GradientBoostingClassifier`, RandomForest); adapter extensible a deep learning |
| Persistencia | PostgreSQL 16 (+ `pgvector` opcional para RAG), Redis 7 |
| Frontend (A) | React 19, Vite, TanStack Router + Query, Tailwind v4, shadcn/Radix, Recharts, Lucide |
| Frontend (B) | Vite + React + TS, operator console |
| Cliente alternativo (A) | Oracle APEX |
| Señales externas | Open-Meteo (clima), open.er-api.com (FX USD/PYG) |
| Packaging | `uv` (Python), `npm`/`bun` (frontend), `uv_build` |
| Secrets | HashiCorp Vault + External Secrets Operator (B) |
| Observabilidad | OpenTelemetry, Prometheus, Grafana, Loki |
| Deploy | Docker Compose (dev/MVP); Helm + Kubernetes connected/air-gapped (B, archivado); Argo Rollouts |
| Supply chain | gitleaks, trufflehog, syft, cosign, Trivy, Grype, OSV-Scanner |

---

## 7. Mapa de specs (roadmap completo)

El roadmap SpecKit completo (heredado del upstream `agro-predict-ai`) tiene 21 specs. Los 001-017 son Producto B; los 018-021 son Producto A.

### Producto B — plataforma y predicción (001-017)

| Spec | Tema |
|---|---|
| 001 | Prediction pipeline (LangGraph StateGraph) |
| 002 | Data ingestion |
| 003 | ML model management |
| 004 | Monitoring dashboard |
| 005 | Admin UI |
| 006 | Oracle APEX integration |
| 007 | Multi-tenancy |
| 008 | Observability stack |
| 009 | Deployment profiles (connected / air-gapped) |
| 010 | Security and secrets |
| 011 | Config management |
| 012 | Queue resilience |
| 013 | LangGraph StateGraph + LLM |
| 014 | Async ARQ dispatch |
| 015 | Real ML model |
| 016 | APEX prediction wiring |
| 017 | Agent health endpoint |

### Producto A — procurement (018-021)

| Spec | Tema |
|---|---|
| 018 | Procurement domain (requests, suppliers, quotations, audit, RLS) |
| 019 | Procurement decision pipeline (scoring + ML + agents) |
| 020 | Procurement negotiation assistant |
| 021 | Procurement APEX application |

---

## 8. Modelo de despliegue

- **MVP (A) hoy**: Docker Compose (PostgreSQL + Redis + ARQ worker + FastAPI) para dev; frontend Vite o app APEX.
- **Full (A + B)**: Kubernetes self-hosted dentro de infraestructura del cliente, perfiles connected y air-gapped, Helm + Argo Rollouts. Estos componentes están hoy en `archive/` (ver [../development/plans/deployment-strategy.md](../development/plans/deployment-strategy.md)); son el tier-full de B, congelados hasta que un trigger de escala los reactive.
- **Sin** SaaS operado por el vendor. **Sin** data plane cross-customer. Secrets, data stores, object storage y cuentas de ML provider son del cliente.

---

## 9. Cómo convergen A y B

1. **Plataforma única**: A y B importan de `platform/`; nunca se duplica persistencia, auth, tenancy, LLM.
2. **Contratos compartidos**: tipos de dominio agro PY (proveedor, departamento, unidad, moneda) comunes.
3. **App factory por tier**: `app.py` monta routers según perfil. MVP arranca solo con A; full arranca A + B. Mismo binario, distinto perfil.
4. **Convergencia funcional futura**: el procurement (A) podrá invocar el `PredictionGraph` (B) para, por ejemplo, forecast de precios de insumos. La separación por `products/` con plataforma común hace esa integración natural.

---

## 10. Documentos relacionados

- [mvp-vs-full-scope.md](mvp-vs-full-scope.md) — distinción precisa entre el alcance del MVP (A) y el full scope (A + B).
- [../development/plans/product-separation.md](../development/plans/product-separation.md) — cómo se separan A y B en monorepo con plataforma compartida (con la diferencia verificada byte a byte contra el upstream).
- [../development/plans/restructure-plan.md](../development/plans/restructure-plan.md) — reestructuración del backend (rename del paquete, capas).
- [../development/plans/deployment-strategy.md](../development/plans/deployment-strategy.md) — por qué k8s/helm/governance enterprise están archivados.

---

*Documento de visión. Consolida A + B. Actualizar cuando cambie el alcance de cualquiera de los dos productos o la plataforma compartida.*

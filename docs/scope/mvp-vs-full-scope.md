# AgroBuy — MVP (A) vs Full Scope (A + B)

> Documento de alcance. Define con precisión qué entra en el **MVP** (Producto A, lo construido y demostrado en el hackatón) y qué pertenece al **full scope** (A + B, la visión completa). Sirve para no confundir lo entregado con lo prometido, y para planificar la convergencia. Visión narrativa completa en [full-scope.md](full-scope.md).

---

## 1. La distinción en una frase

- **MVP (A)** = copiloto de compras agro que **corre hoy**: pipeline vanilla, 4 agentes LLM, ML supplier predictor, dual scoring, señales en vivo, API + React/APEX. Es lo demostrable.
- **Full scope (A + B)** = el MVP **más** la plataforma predictiva multi-agente de B (LangGraph, 5 agentes con guards, governance enterprise, devops K8s self-hosted air-gapped) **convergiendo sobre la misma plataforma técnica**.

A no es un prototipo desechable: es la primera vertical del producto A + B. B no es legacy: es la dirección de largo plazo, hoy silenciada en el repo.

---

## 2. Tabla comparativa por dimensión

| Dimensión | MVP (Producto A) | Full Scope (A + B) |
|---|---|---|
| **Producto** | Copiloto de compras (procurement) | Plataforma de inteligencia predictiva y operativa agro/logística |
| **Usuario** | Comprador de cooperativa | Comprador + operador de plataforma + analista de predicciones + admin de tenant |
| **Pipeline IA** | Orquestador vanilla lineal | + LangGraph StateGraph con guards y escalation sinks |
| **Agentes** | 4 LLM (extractor, comparator, recommender, negotiator) | + 5 agentes de predicción (data_analyst, ml_executor, recommendation_engine, explainability, reviewer) |
| **ML** | Supplier predictor (GBM, AUC 0.748) + anomaly detector | + model management, training pipeline, shadow-mode, drift detection, regresión de accuracy |
| **Datos externos** | Open-Meteo + FX USD/PYG | + ingesta de sensores/satélite, ETL, data quality gates formales |
| **Frontend** | App React de compras (+ cliente APEX) | + operator console (control-room, graph-editor, flow-simulator, tenant-admin) |
| **Persistencia** | PostgreSQL + RLS | + checkpointing LangGraph, audit completo, config versionada con shadow-mode, RAG opcional `pgvector` |
| **Multi-tenancy** | Tenant fijo demo (`tenant-coopagro`) | Aislamiento real por tenant/team de credenciales, datos, modelos, budgets y cola |
| **Governance** | No aplica | Billing/metering, compliance, DPA gate, retención, rotación de credenciales con SLA, DR (RPO/RTO) |
| **Observabilidad** | Health checks + logs | + OTel/Prometheus/Grafana/Loki, SLOs, burn-rate alerting, status page, runbooks |
| **Deploy** | Docker Compose | + Kubernetes self-hosted, perfiles connected/air-gapped, Helm, Argo Rollouts, progressive delivery |
| **Seguridad/secrets** | `.env` local, Fernet key | + Vault + External Secrets Operator, supply-chain hardening, break-glass dual-control |
| **Specs** | 018-021 | 001-021 |
| **Estado en el repo** | Activo (front + back) | Backend vivo pero no consumido; consola desconectada; devops en `archive/` |

---

## 3. Qué está dentro y fuera del MVP

### Dentro del MVP (A) - construido y verificado

- Domain layer de procurement: requests, suppliers, quotations, audit, RLS (spec 018).
- Señales externas: Open-Meteo (cache 6h) + FX USD/PYG (cache 1h, fallback).
- Dual scoring (Urgency + Offer) + matriz de decisión.
- ML supplier predictor (`GradientBoostingClassifier`, AUC 0.748 sobre un historial sintético) + anomaly detector (rango contra las bandas del catálogo).
- 4 agentes LLM con fallback determinístico.
- Orchestrator end-to-end + endpoints (extract, recommend, negotiate).
- Fixtures demo: 8 proveedores, 6 catálogo, 5 solicitudes, 15 cotizaciones, 157 deliveries.
- Frontend React (7 páginas del comprador) + build guide de la app Oracle APEX.
- 62/62 tests procurement verdes, 528 totales, smoke E2E en vivo.

### Fuera del MVP, dentro del full scope (B)

- Pipeline de predicción LangGraph con guards (data quality, explainability, reviewer).
- Model management con shadow-mode, drift detection y regresión de accuracy.
- Operator console (graph-editor, flow-simulator, interrupts, tenant-admin).
- Multi-tenancy real con aislamiento de budgets y cola; weighted-fair queueing.
- Governance enterprise (billing, compliance, DPA, retención, DR).
- Despliegue K8s self-hosted, air-gapped, progressive delivery con rollback.
- Vault + External Secrets, supply-chain hardening.
- RAG opcional vía `pgvector`.

---

## 4. Reglas que diferencian A de B

| Aspecto | MVP (A) | Full (B) |
|---|---|---|
| Aprobación humana | No hay; el pipeline es automático | Break-glass solo en paths de excepción (security, regresión de accuracy, datos contradictorios, budget agotado, política violada) |
| Cadena obligatoria | load -> score -> recomendar | model execution -> tests -> explainability verification -> review approval antes de release |
| Gate de datos | Validaciones de calidad en el domain | Data quality gate formal: ninguna predicción antes de validar fuentes y confirmar readiness |
| Falla de agente | Fallback determinístico inline | Señal explícita a downstream + escalation sink registrado + degradación grácil |
| Comunicación entre agentes | Llamadas Python directas | Solo por estado LangGraph (no API directa inter-agente) |

> Importante: el MVP **no viola** las non-negotiables de B; simplemente no las ejerce todas porque su pipeline es más simple. La convergencia consiste en envolver A bajo las mismas garantías de B cuando escale, no en reescribirlo.

---

## 5. El criterio de corte (verificado contra el upstream)

La línea entre A y B no es de juicio: está verificada byte a byte contra el upstream `agro-predict-ai` (ver [../development/plans/product-separation.md §2.1](../development/plans/product-separation.md)).

- **Backend**: A = el módulo `procurement/` + su wiring en `app.py` + CORS. B = los 24 módulos restantes (23 idénticos al upstream + `predictions/`). El único archivo modificado del upstream es `app.py`, de forma aditiva.
- **Frontend**: A = `routes/`, `hooks/`, `router.tsx`, componentes business (AppHeader, AppSidebar, ChatPanel, PageShell, Pills). B = `App.tsx` + consola multi-agente (huérfana).
- **Specs**: A = 018-021. B = 001-017. A es literalmente la implementación de los specs 018-021 del roadmap de B.

---

## 6. Camino de convergencia (de A hacia A + B)

Orden recomendado, sin big-bang:

1. **Estabilizar A** (cerrar Tier 1 del rename del paquete; ver [../development/plans/restructure-plan.md](../development/plans/restructure-plan.md)).
2. **Separar superficies** en `platform/` + `products/{procurement,predictions}` + `governance/` (ver product-separation.md), preservando que A corre igual.
3. **App factory por tier**: setting `AGROBUY_TIER` (`mvp` | `full`). MVP expone solo `/api/v1/procurement`; full expone todo.
4. **Revivir B incrementalmente** por valor: primero lo que A puede consumir (ej. `PredictionGraph` para forecast de precios de insumos), no la consola entera de una vez.
5. **Reactivar devops de B** solo cuando un trigger de escala lo justifique (ver deployment-strategy.md): multi-cliente real, requisito air-gapped de un cliente, SLA contractual.

---

## 7. Cómo presentar cada alcance

- **Demo / pitch / hackatón**: mostrar A (es lo que funciona end-to-end en vivo). Citar B como roadmap.
- **Inversores / visión de producto**: A + B (el MVP prueba ejecución; B prueba ambición y moat técnico).

---

*Documento de alcance. Mantener sincronizado con full-scope.md y product-separation.md si cambia qué pertenece a A vs B.*

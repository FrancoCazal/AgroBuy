# Estrategia de deployment — AgroBuy

> Documento de decisión. Define el path de deployment activo del proyecto y el estado del soporte Kubernetes/Helm existente.

---

## 1. Decisión

**Path activo: Docker (containers + docker-compose).**
**Path archivado: Kubernetes + Helm.**

Toda evolución de deployment en el corto/medio plazo se hace sobre la base de imágenes Docker construidas desde [backend/Dockerfile](../backend/Dockerfile) y [frontend/Dockerfile](../frontend/Dockerfile), orquestadas localmente y en hosts simples (VMs, plataformas PaaS) con `docker compose`. El stack de K8s/Helm pre-existente en `agro-predict-ai/helm/` y `agro-predict-ai/k8s/` se conserva en el repo pero queda **archivado** — no se mantiene ni se sincroniza con cambios de la app hasta que un trigger explícito (sección 6) justifique reactivarlo.

---

## 2. Contexto y motivación

### Estado del repo previo a esta decisión

El subdirectorio `agro-predict-ai/` (estructura original del scaffold) contiene una capa de deployment K8s **muy ambiciosa**:

- Helm chart con 21 templates: Argo Rollouts (canary con análisis de métricas), gVisor RuntimeClass (sandbox kernel-level), External Secrets + Vault, NetworkPolicy, PodDisruptionBudget, HPA por servicio, PagerDuty integration, status page sync CronJob, perfil air-gapped.
- Manifiestos K8s sueltos para dev (`k8s/backend.yaml`, `k8s/frontend.yaml`, `k8s/dev-config.yaml`).
- Scripts de bootstrapping (`bootstrap_air_gapped_vault.sh`) y gates de CI (`openapi_diff_gate.py`, `check_license_allowlist.py`).
- Targets en `Makefile` para `minikube-up`, `port-forward`, `smoke-test`.

### Diagnóstico

Esa infraestructura es **adecuada para un producto enterprise maduro con equipo SRE dedicado y SLA contractual**. No es adecuada para el momento actual del proyecto, que es **hackathon / MVP early stage**.

Indicadores concretos del mismatch:

| Componente presente | Premisa que requiere | Realidad del proyecto |
|---|---|---|
| **gVisor RuntimeClass** | El producto ejecuta código no confiable (notebooks, code interpreters) | El producto es un copiloto de compras — no ejecuta código de terceros |
| **Air-gapped profile + Vault bootstrap** | Cliente sin internet (banca, defensa, gobierno) | Mercado objetivo: cooperativas agro paraguayas con internet normal |
| **Argo Rollouts con AnalysisTemplate** | Equipo SRE midiendo SLOs y métricas Prometheus para promoción automática | Equipo chico, sin SLO definidos, sin clientes pagando por uptime |
| **PagerDuty + on-call** | Rotación 24/7 contestando incidentes | Sin equipo de soporte 24/7 |
| **HPA por servicio** | Carga real medible que justifique autoscaling | Carga 0 fuera de demos |
| **NetworkPolicy granular** | Cluster multi-tenant con segregación obligatoria | Cluster propio o aún sin cluster |
| **Status Page Sync CronJob** | Página de estado pública para clientes con SLA | Sin clientes externos todavía |

Es la consecuencia típica de un scaffold generado por agentes IA con mandato de "producción enterprise-ready" sin filtrar por madurez del producto.

### Por qué Docker compose es el path correcto hoy

1. **La misma imagen sirve para todo el espectro**: dev local, demos, deploy temprano (Render/Railway/Fly.io/Cloud Run/VM con compose) y, el día que llegue K8s, esa misma imagen se mete en un Pod sin cambios. La inversión en `Dockerfile` no se tira.
2. **Setup y mantenimiento en horas**: `docker compose up` levanta backend + frontend + Postgres + Redis + worker en una orden. Para llegar al mismo estado con K8s necesitás cluster, ingress controller, cert-manager, secret manager, observabilidad — días o semanas de ops antes de poder demoar nada.
3. **El producto se desarrolla más rápido**: cada hora invertida en YAMLs de K8s es una hora no invertida en la lógica de scoring, en los agentes IA, en el frontend del copiloto. En esta etapa la ventaja competitiva es la calidad del producto, no la robustez del deployment.
4. **No introduce deuda técnica**: archivar Helm/K8s no rompe nada. Cuando se necesite, se descomprime y se actualiza contra la app de ese momento.

---

## 3. Qué queda como path activo

### Componentes mantenidos

| Componente | Ubicación | Rol |
|---|---|---|
| `Dockerfile` del backend | [backend/Dockerfile](../backend/Dockerfile) | Imagen del API FastAPI + ARQ worker |
| `Dockerfile` del frontend | [frontend/Dockerfile](../frontend/Dockerfile) | Imagen del SPA Vite servido por nginx |
| `docker-compose.yml` | `agro-predict-ai/docker-compose.yml` (a mover a raíz tras la disolución de `agro-predict-ai/`) | Stack local completo: postgres + redis + backend + frontend + worker (perfil) + oracle (perfil) + seed (perfil) |
| `.env.example` | A mover a raíz | Plantilla de variables de entorno |
| `Makefile` targets relevantes | `agro-predict-ai/Makefile` (a relocalizar) | `local-up`, `local-down`, `local-logs`, `dev-backend`, `dev-frontend`, `dev-worker` |

### Targets de deployment soportados

| Target | Cómo se deploya | Cuándo usar |
|---|---|---|
| **Dev local** | `docker compose up -d` desde la raíz | Desarrollo diario |
| **Hybrid local** | `docker compose up -d postgres redis` + `make dev-backend` + `make dev-frontend` | Hot-reload de backend y frontend, infra en containers |
| **Demo en VM** | VM (DigitalOcean / Linode / Hetzner) + docker compose + Caddy o Cloudflare Tunnel para TLS | Demos a stakeholders, ambiente staging compartido |
| **PaaS managed** | Render / Railway / Fly.io / Google Cloud Run con la misma imagen Docker | Primer cliente real, antes de tener volumen |

### Componentes que se renuncia explícitamente a tener (por ahora)

- Sin canary deploys: la promoción se hace por redeploy total (`docker compose pull && docker compose up -d`).
- Sin autoscaling: una sola instancia de backend, una de worker, una de frontend hasta que la carga lo justifique.
- Sin alta disponibilidad: aceptamos downtime de minutos durante deploy.
- Sin observabilidad enterprise: logs por `docker compose logs`, métricas básicas vía endpoints de health/metrics que ya expone FastAPI.
- Sin sandbox de seguridad avanzado (gVisor, seccomp custom): aceptamos el modelo de aislamiento por defecto de Docker.

Cada una de estas renuncias es **explícita y revisable** cuando llegue el momento (sección 6).

---

## 4. Qué queda archivado y cómo

### Componentes a archivar

Cuando ejecutemos la disolución de `agro-predict-ai/` (ver [restructure-plan.md §7](restructure-plan.md)), los siguientes paths se mueven a un destino `archive/k8s/` en la raíz (o se conservan en `agro-predict-ai/` que actúa de facto como archive):

| Path archivado | Contenido |
|---|---|
| `helm/` | Chart Helm completo (Chart.yaml, values*.yaml, templates/, policies/) |
| `k8s/` | Manifiestos K8s sueltos (backend.yaml, frontend.yaml, dev-config.yaml) |
| `scripts/bootstrap_air_gapped_vault.sh` | Bootstrap de Vault para air-gapped |
| `operations/alerts/` y `operations/dashboards/` | Reglas Prometheus y dashboard Grafana — útiles cuando haya observabilidad montada |
| Targets `minikube-*` del Makefile | Se mueven a `archive/k8s/Makefile.minikube` o se borran del Makefile activo |

### Reglas del archive

1. **Sin sincronización automática**: la app evoluciona libremente. Los YAMLs archivados quedarán desactualizados respecto a la imagen real (variables nuevas, puertos cambiados, nuevos servicios). Eso es esperado y aceptable.
2. **Sin tests sobre el archive**: nada del CI corre contra los manifiestos archivados.
3. **README en el archive**: el directorio `archive/k8s/` (o equivalente) debe tener un `README.md` que diga: cuándo se archivó, qué versión de la app refleja, qué falta actualizar al reactivarlo.
4. **Borrable**: el archive se puede borrar en cualquier momento si nadie lo defiende; el historial de git lo conserva.

### Decisión de ubicación: ¿`archive/` en raíz o seguir en `agro-predict-ai/`?

Pendiente. Dos opciones:

- **Opción A**: crear `archive/k8s/` en la raíz y mover ahí los paths archivados. `agro-predict-ai/` se disuelve completamente (sus piezas útiles como `docker-compose.yml`, `Makefile`, `contracts/openapi/`, `.env*` se mueven a la raíz).
- **Opción B**: mantener `agro-predict-ai/` como contenedor de archive, sin nada más adentro. Renombrarlo a `archive/` o `legacy/`.

Recomendación: **Opción A** — más limpio, no deja un subdirectorio con nombre confuso ("agro-predict-ai" suena a "el proyecto", no a "lo archivado").

---

## 5. Documentación del full scope (qué describe el producto)

El "full scope" del producto NO está en los YAMLs de K8s. Está en los siguientes documentos, que **sí se mantienen activos** independientemente del path de deployment:

### Docs existentes a mantener actualizados

| Doc | Qué describe |
|---|---|
| [README.md](../README.md) (raíz, por crear) | Quickstart, qué es el producto, cómo correr localmente |
| [agro-predict-ai/README.md](../agro-predict-ai/README.md) | Brief de producto, status de fases, métricas de tests, contexto hackathon |
| [docs/agro_procurement_weather_scoring.md](agro_procurement_weather_scoring.md) | Modelo de scoring dual (urgency + offer) con datos climáticos |
| [docs/agro/](agro/) | Contexto del dominio agro: AGRO_cosechas, AGRO_MVP, agropy_editado, critical_ops_agro |
| [docs/compras/](compras/) | Plan de producto y dev plan ejecutable (COMPRAS_AGRO_plan.md, DEV_PLAN.md) |
| [docs/docssystem/](docssystem/) | Diseño técnico del sistema: agent-pipeline-flow, Oracle APEX guide, runbooks, metering, api |
| [agro-predict-ai/contracts/openapi/openapi-v1.json](../agro-predict-ai/contracts/openapi/openapi-v1.json) | Contrato de la API REST: endpoints, schemas, ejemplos |
| [agro-predict-ai/.specify/memory/constitution.md](../agro-predict-ai/.specify/memory/constitution.md) | Principios fundacionales del proyecto |

### Docs que faltan y deberían crearse

| Doc | Qué describiría | Prioridad |
|---|---|---|
| `README.md` raíz | Quickstart real contra la estructura post-movida, links a docs por temática | Alta |
| `docs/architecture.md` | Diagrama de componentes (backend + frontend + DB + cache + workers + LLM + señales externas) y flujo de los 2 pipelines IA | Media |
| `docs/local-dev.md` | Guía completa de docker compose: perfiles, troubleshooting, seed data, cómo correr tests | Media |
| `docs/data-model.md` | Esquema de DB y modelos de dominio (PurchaseRequest, Quotation, Supplier, Score, NegotiationDraft) | Media |
| `docs/llm-agents.md` | Los 4 agentes LLM del procurement pipeline y los 5 del predictions LangGraph: prompts, fallbacks, contratos | Media |
| `docs/observability.md` | Cuando llegue, cómo se ven logs/métricas/traces en el modo activo (compose) y en el archivado (k8s+prometheus) | Baja |

El criterio: **describir qué hace el producto y cómo se desarrolla, no dónde corre en producción**. El dónde es variable; el qué es estable.

---

## 6. Triggers para reactivar K8s

K8s/Helm se reactiva (descongela del archive y se actualiza contra la app de ese momento) cuando se cumpla **al menos uno** de estos triggers:

1. **Cliente enterprise lo pide en el contrato**: una cooperativa grande, un proveedor de insumos enterprise o un cliente gobierno que en sus requisitos de procurement IT exija deployment K8s on-prem o en su cloud.
2. **Carga real que justifica autoscaling**: tráfico sostenido > 100 req/s o latencia que no se resuelve con scale vertical en una sola VM.
3. **Necesidad de alta disponibilidad real (SLA contractual)**: cláusula de uptime ≥ 99.9% con penalización financiera.
4. **Multi-region por compliance**: requisitos de residencia de datos en múltiples regiones (poco probable en el corto plazo).
5. **Volumen de workers que excede una VM**: si los pipelines ARQ + ML batch requieren más de lo que da una instancia razonable.

### Qué no es trigger

- "Porque queremos hacerlo bien desde el principio" → no, hacerlo bien desde el principio es **no agregar complejidad innecesaria**.
- "Para impresionar en demos técnicas" → si la demo necesita impresionar con la infra y no con el producto, hay un problema más profundo.
- "Porque el scaffold ya lo trae" → la presencia previa no es justificación; lo que justifica es el problema actual.

---

## 7. Roadmap de deployment por etapa del producto

| Etapa | Estado del proyecto | Deployment recomendado | Triggers para pasar a la siguiente |
|---|---|---|---|
| **0 — Hackathon / proto** | Hoy | `docker compose up` local + demo en una VM con compose | Hay primer cliente real interesado |
| **1 — MVP con 1-5 clientes piloto** | Por venir | VM única (DigitalOcean / Hetzner) con docker compose + Caddy/Cloudflare Tunnel para TLS, backups manuales de Postgres | Más de 5 clientes activos, carga incremental |
| **2 — Beta con 5-20 clientes** | Más adelante | PaaS managed (Render / Railway / Fly.io / Cloud Run) o VMs múltiples con compose; Postgres managed; backups automatizados; logs centralizados básicos | Cliente exige SLA con cláusula de penalización, o carga supera lo que da una VM grande |
| **3 — Producción multi-cliente con SLA** | Futuro condicional | **K8s con Helm mínimo**: deployment, service, configmap, secret, ingress, HPA (5-6 templates, no 21) | Cliente exige air-gapped, o multi-region, o gobierno |
| **4 — Enterprise con clientes regulados** | Sólo si llega | Helm completo (descongelar archive y actualizar): rollouts canary, External Secrets+Vault, NetworkPolicy, observabilidad full, on-call | N/A |

---

## 8. Acciones inmediatas (no en este doc, sólo referencia)

Estas son las acciones derivadas de esta decisión. **Este documento NO las ejecuta** — quedan trackeadas en [restructure-plan.md §7](restructure-plan.md):

- [ ] Disolver `agro-predict-ai/` (ver Opción A del restructure plan)
- [ ] Mover `docker-compose.yml` a raíz, ajustar paths a `./backend` y `./frontend`
- [ ] Mover `.env.example` y `Makefile` (sólo targets activos) a raíz
- [ ] Crear `archive/k8s/` en raíz, mover ahí `helm/`, `k8s/`, scripts air-gapped, alerts/dashboards y targets minikube del Makefile
- [ ] Crear `archive/k8s/README.md` con: fecha de archivo, versión de app reflejada, instrucciones para reactivar
- [ ] Crear `README.md` raíz con quickstart contra la nueva estructura
- [ ] Decidir entre Opción A (`archive/` en raíz) y B (renombrar `agro-predict-ai/` a `archive/`)

---

## 9. Resumen en una línea

Hoy se desarrolla con **Docker containers + docker-compose** para todo. K8s/Helm queda en `archive/` como inversión congelada, descongelable cuando un cliente real lo justifique. El producto se documenta en `docs/` por **qué hace**, no por **dónde corre**.

---

*Última actualización: este doc refleja la decisión al momento de su creación. Cuando un trigger de la sección 6 se active, actualizar este doc antes de descongelar el archive.*

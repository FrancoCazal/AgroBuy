# Estrategia de separación de productos — AgroBuy

> Documento de decisión y plan. Define cómo se separan las dos superficies de producto que hoy coexisten en el repo (**AgroBuy MVP** y **AgroBuy real**) sobre una **plataforma compartida**, preservando que la dirección final es **A + B convergiendo**, no un divorcio.

---

## 1. Resumen ejecutivo

El repo contiene dos productos con la misma filosofía y dominio (agro PY), en distinto grado de madurez:

| | **Producto A — AgroBuy MVP** | **Producto B — AgroBuy real** |
|---|---|---|
| Qué es | El recorte que corre hoy: copiloto de compras (procurement) | El sistema ambicioso original: plataforma multi-agente de predicción + devops kit completo |
| Estado | Activo en front y back; es lo que se demuestra | Backend vivo pero sin consumidor; frontend desconectado; devops archivado |
| Madurez | MVP funcional | Visión completa, parcialmente implementada, "apagada" para el hackatón |

**Dirección final: A + B.** B no reemplaza a A ni A descarta a B. A es el MVP que funciona hoy; B es hacia dónde converge el producto. Comparten plataforma, dominio y filosofía.

**Modelo de separación elegido:** monorepo único, **plataforma compartida**, dos superficies de producto separadas en `products/`. Permite que A corra hoy, que B se reviva de forma incremental, y que ambos converjan sobre la misma base sin duplicar infraestructura.

---

## 2. Historia, contexto y diferencia real verificada

Fundamentado en [docs/compras/DEV_PLAN.md](compras/DEV_PLAN.md), sección "Decisiones arquitectónicas (fijas)":

1. **El repo `agro-predict-ai-main` (Producto B) es la base.** No se reescribió la plataforma; el MVP se construyó encima.
2. **Decisión #3**: "Los 4 agentes de procurement son módulo nuevo, no extensión del `PredictionGraph` agronómico existente. **Ambos grafos conviven.**"
3. **Sección "Ignoramos para el hackatón (no remover, no tocar)"**: los 5 agentes agronómicos, `PredictionGraph` (corn), `helm/`, `k8s/`, el frontend operator console. Es decir, B se silenció pero quedó intacto adentro del repo.

Conclusión: el procurement MVP (A) es una capa nueva sobre la plataforma de B. Lo que hoy se ve como "código residual" de B no es basura — es la v0 ambiciosa que se recortó y que define la dirección de largo plazo.

### 2.1 Verificación byte a byte contra el upstream

Esta historia ya no es inferencia. Se verificó comparando el repo actual (`AgroBuy`) contra el upstream prístino (`agro-predict-ai`, copia hermana fuera del repo). Resultado:

**Linaje confirmado.** `agro-predict-ai` es el ancestro directo. La fórmula exacta es:

```
AgroBuy = agro-predict-ai
          + módulo backend procurement/
          + app de frontend procurement (TanStack Router)
          + rename backend/src/backend/ -> backend/agropredict/
          + archive/ (helm, k8s, operations, specs, .specify movidos)
```

**El upstream NO es "B puro previo a A".** Es "B con procurement ya planificado pero aún no implementado". El upstream ya contiene los specs `013-017` (langgraph-llm, arq, real-ml, apex-wiring, agent-health) y `018-021` de procurement (`018-procurement-domain`, `019-procurement-decision-pipeline`, `020-procurement-negotiation-assistant`, `021-procurement-apex-application`). Es decir: **A es la implementación de los specs 018-021 del roadmap de B.** Procurement no es un injerto externo; es la continuación natural de la hoja de ruta de B. Esto respalda empíricamente la tesis "A + B es la misma filosofía, A es la dirección final".

#### Backend: el delta es puramente aditivo

Comparación `diff -rq` de los 24 módulos compartidos (excluyendo `procurement/` y `__pycache__`):

| Medida | Resultado |
|---|---|
| Módulos compartidos idénticos byte a byte | **23 de 24** |
| Único archivo que difiere | **`app.py`** |
| Archivos agregados/borrados en módulos compartidos | **ninguno** |
| Módulos nuevos en AgroBuy | **solo `procurement/`** |
| Referencias a "procurement" en el código del upstream | **cero** |

La plataforma de B (persistence, security, tenancy, observability, queue, webhook, llm, integrations, runtime, control_plane, knowledge, data_ingestion, ml_models, supply_chain, predictions, billing, compliance, operations, deployment, governance, config, credentials, testing, platform) está **intacta**: AgroBuy no reescribió nada de B, solo le montó procurement encima. Esto cierra la incertidumbre de §5 sobre módulos "borderline": ninguno fue modificado para A, todos son B prístino.

#### El único cambio en `app.py` es aditivo

El diff de `app.py` muestra que AgroBuy **agrega** sin tocar la lógica existente de B:

- Middleware **CORS** (nuevo; orígenes vía `BACKEND_CORS_ORIGINS`).
- Imports y wiring de procurement: `agents/{extractor,comparator,recommender,negotiator}`, `api`, `chat`, `decision_repository`, `external/{repository,service}`, `ml/supplier_predictor`, `orchestrator`, `repository`, `service`.
- Adaptador LLM (`build_llm_adapter(LLMConfig.from_env())`) con fallback determinista cuando `LLM_ENABLED=false`, para que la demo siempre corra.
- `app.include_router(build_procurement_router(...))` y `build_chat_router(...)`.
- El resto del factory (lifespan, migraciones, healthz/readyz/metrics, runtime/simulate, status-page, predictions, models, apex, platform routers, knowledge, admission, billing, webhook, credential rotation, data retention, DPA gate) es **idéntico** al upstream.

> Residuo a corregir en la Tier 1 de [restructure-plan.md](restructure-plan.md): `main()` en `app.py` todavía imprime `uv run ... backend/src/backend/app.py`, ruta que ya no existe tras el rename.

#### Frontend: console de B orfanada + app de A nueva

El upstream tiene **solo** la consola de operador de B. AgroBuy la conservó como código huérfano y montó encima la app de procurement:

| | Upstream (`agro-predict-ai`) | AgroBuy (actual) |
|---|---|---|
| Qué monta `main.tsx` | `<App/>` (consola B) | `<RouterProvider/>` (app A) |
| Routing | ninguno (shell por tabs en `App.tsx`) | TanStack Router file-based (`routes/`, `routeTree.gen.ts`, `router.tsx`) |
| Componentes | AgentHealthPanel, DynamicPixelOffice, FlowSimulator, PredictionList, FeatureFlagManager, TenantManager | + nuevos de A: AppHeader, AppSidebar, ChatPanel, PageShell, Pills (los de B siguen presentes, huérfanos) |
| `lib/` | graphSimulator, graphValidation | + api/format/utils/types/hooks de A |

Es decir: la consola de B en AgroBuy **no fue borrada ni modificada en esencia, fue desconectada** (`App.tsx` ya no se monta). Coincide con la decisión del DEV_PLAN de "no remover, no tocar" el operator console.

#### DevOps y raíz del repo

El upstream tiene `helm/`, `k8s/`, `operations/`, `specs/` y `.specify/` **vivos en la raíz**. AgroBuy los movió a `archive/` (documentado en [deployment-strategy.md](deployment-strategy.md)). No se borraron: son el tier-full de B, congelados hasta que un trigger los reactive.

### 2.2 Síntesis de la diferencia real

| Eje | Diferencia entre repos | Diferencia entre A y B |
|---|---|---|
| Backend | AgroBuy = upstream + `procurement/` + wiring en `app.py` + rename a `agropredict/` | A = `procurement/` (módulo + su wiring); B = los 24 módulos restantes (plataforma + predicción + governance) |
| Frontend | AgroBuy = upstream + app TanStack Router; console de B desconectada | A = `routes/` + componentes business; B = `App.tsx` + consola multi-agente (huérfana) |
| Specs | iguales: ambos tienen 001-021 | A = specs 018-021 (procurement); B = specs 001-017 (predicción/plataforma/devops) |
| DevOps | upstream en raíz; AgroBuy en `archive/` | todo el devops kit es B (tier-full) |
| IA | misma plataforma LLM | A = orchestrator vanilla lineal; B = LangGraph StateGraph con checkpointing |

**Lectura final:** AgroBuy no es un fork divergente de `agro-predict-ai`; es **el mismo repo con una capa de producto (A) montada sobre una base (B) que quedó intacta pero silenciada**. Esto es exactamente lo que hace viable la separación por `products/` con plataforma compartida: no hay que reconciliar dos linajes de código, solo reorganizar lo que ya convive limpiamente.

---

## 3. Los dos productos en detalle

### Producto A — AgroBuy MVP (compras)
- **Propósito**: copiloto de compras para cooperativas agro. Registrar solicitudes, cargar cotizaciones, comparar, recomendar, generar mensajes de negociación.
- **Pipeline IA**: orchestrator vanilla (secuencia Python lineal), 4 agentes LLM (extractor, comparator, recommender, negotiator) con fallback determinista.
- **Endpoints**: `/api/v1/procurement/*`.
- **Frontend**: app business montada (TanStack Router), rutas de compras.

### Producto B — AgroBuy real (plataforma multi-agente)
- **Propósito**: plataforma predictiva agronómica multi-agente con consola de operador, governance enterprise y devops completo.
- **Pipeline IA**: `PredictionGraph` (LangGraph StateGraph) con 5 agentes (Aline, Mila, Nico, Sofia, Ravi), checkpointing en Postgres, runtime de orquestación, control plane.
- **Endpoints**: `/api/v1/predictions`, `/api/v1/runtime`, `/api/v1/data`, `/api/v1/models`, APEX, agent-health, admission.
- **Frontend**: consola de operador (pixel office) con tabs control-room, interrupts, graph-editor, flow-simulator, predictions, tenant-admin. Hoy **desconectada** (`App.tsx` huérfano).
- **DevOps**: k8s, helm, spec-driven dev, governance — hoy en `archive/`.

### Plataforma (de ambos)
Infraestructura transversal que A y B comparten: persistencia, seguridad, multi-tenancy, observabilidad, cola async, LLM adapter, integraciones, config.

---

## 4. Modelo target (monorepo, plataforma compartida)

### Backend

```
backend/agropredict/
├── __init__.py
├── app.py                       # factory: monta routers segun perfil/tier
├── config/                      # Pydantic Settings
│
├── platform/                    # NUCLEO COMPARTIDO (A y B)
│   ├── persistence/             # SQLAlchemy, RLS, sesiones
│   ├── security/                # auth, JWT, encryption
│   ├── credentials/             # secrets, KMS
│   ├── tenancy/                 # multi-tenant scoping
│   ├── observability/           # logs, metrics, traces
│   ├── queue/                   # ARQ + worker
│   ├── webhook/                 # webhooks entrantes
│   ├── llm/                     # LLM adapter + circuit breaker
│   ├── integrations/            # oracle_apex, github
│   └── testing/                 # helpers de test
│
├── products/
│   ├── procurement/             # PRODUCTO A — AgroBuy MVP
│   │   ├── agents/              # extractor, comparator, recommender, negotiator
│   │   ├── scoring/             # urgency, offer, decision_matrix
│   │   ├── ml/                  # supplier_predictor, anomaly_detector
│   │   ├── external/            # weather, FX, departments
│   │   ├── chat/                # chat copilot
│   │   ├── fixtures/            # seed demo
│   │   ├── orchestrator.py, service.py, repository.py, api.py, models.py
│   │
│   └── predictions/             # PRODUCTO B — AgroBuy real
│       ├── agents/              # Aline, Mila, Nico, Sofia, Ravi
│       ├── runtime/             # workflow StateGraph, planner, store
│       ├── control_plane/       # orquestacion admin
│       ├── knowledge/           # RAG
│       ├── data_ingestion/      # ETL pipeline
│       ├── ml_models/           # registry de modelos (corn, etc.)
│       ├── supply_chain/        # admission
│       ├── graph.py, service.py, repository.py, api.py
│
└── governance/                  # TIER FULL de B (enterprise, hoy dormido)
    ├── billing/
    ├── compliance/
    ├── operations/
    └── deployment/
```

### Frontend

```
frontend/src/
├── main.tsx                     # entry: elige que shell montar (A por defecto)
│
├── shared/                      # base compartida (A y B)
│   ├── components/ui/           # primitives shadcn/Radix
│   ├── lib/                     # api, format, utils, types
│   └── i18n/
│
├── products/
│   ├── procurement/             # PRODUCTO A — montado hoy
│   │   ├── router.tsx
│   │   ├── routes/              # inbox, nueva, cargar, comparar, solicitud, proveedores, dashboard, chat
│   │   └── components/          # PageShell, Pills, ChatPanel, AppHeader, AppSidebar
│   │
│   └── console/                 # PRODUCTO B — operator console (revivible)
│       ├── App.tsx              # shell multi-agente (hoy huerfano)
│       ├── components/          # AgentHealthPanel, FlowSimulator, DynamicPixelOffice, PredictionList, FeatureFlagManager, TenantManager
│       ├── lib/                 # graphSimulator, graphValidation
│       └── data/                # sampleData (agentCards, spriteManifest)
│
└── public/
    └── assets/sprites/          # assets del Producto B (pixel office)
```

---

## 5. Mapeo de clasificación (módulo por módulo)

### Backend — estado actual → destino

| Módulo actual (`agropredict/`) | Producto | Destino |
|---|---|---|
| `procurement/` | **A** | `products/procurement/` |
| `predictions/` | **B** | `products/predictions/` |
| `runtime/` | **B** | `products/predictions/runtime/` |
| `control_plane/` | **B** | `products/predictions/control_plane/` |
| `knowledge/` | **B** | `products/predictions/knowledge/` |
| `data_ingestion/` | **B** | `products/predictions/data_ingestion/` |
| `ml_models/` | **B** | `products/predictions/ml_models/` |
| `supply_chain/` | **B** | `products/predictions/supply_chain/` |
| `persistence/` | Plataforma | `platform/persistence/` |
| `security/` | Plataforma | `platform/security/` |
| `credentials/` | Plataforma | `platform/credentials/` |
| `tenancy/` | Plataforma | `platform/tenancy/` |
| `observability/` | Plataforma | `platform/observability/` |
| `queue/` | Plataforma | `platform/queue/` |
| `webhook/` | Plataforma | `platform/webhook/` |
| `llm/` | Plataforma | `platform/llm/` |
| `integrations/` | Plataforma | `platform/integrations/` |
| `config/` | Plataforma | `config/` (raíz del paquete) |
| `platform/` (carpeta existente) | Plataforma | fusionar en `platform/` (revisar contenido) |
| `testing/` | Plataforma | `platform/testing/` |
| `billing/` | **B (tier full)** | `governance/billing/` |
| `compliance/` | **B (tier full)** | `governance/compliance/` |
| `operations/` | **B (tier full)** | `governance/operations/` |
| `deployment/` | **B (tier full)** | `governance/deployment/` |
| `governance/` (carpeta existente) | **B (tier full)** | fusionar en `governance/` (revisar contenido) |

### Frontend — estado actual → destino

| Archivo/carpeta actual | Producto | Destino |
|---|---|---|
| `main.tsx` | Entry | `main.tsx` (elige shell) |
| `router.tsx`, `routeTree.gen.ts` | **A** | `products/procurement/` |
| `routes/*` | **A** | `products/procurement/routes/` |
| `components/PageShell, Pills, ChatPanel, AppHeader, AppSidebar` | **A** | `products/procurement/components/` |
| `App.tsx` | **B** | `products/console/App.tsx` |
| `components/AgentHealthPanel, FlowSimulator, DynamicPixelOffice, PredictionList, FeatureFlagManager, TenantManager` | **B** | `products/console/components/` |
| `lib/graphSimulator.ts, graphValidation.ts` | **B** | `products/console/lib/` |
| `data/sampleData.ts` | **B** | `products/console/data/` |
| `public/assets/sprites/*` | **B** | `public/assets/sprites/` (queda; es del console) |
| `components/ui/*` | Compartido | `shared/components/ui/` |
| `lib/api.ts, format.ts, utils.ts, types.ts, role.tsx` | Compartido | `shared/lib/` |
| `lib/mockData.ts` | Compartido/A | `shared/lib/mocks/` o `products/procurement/` (revisar uso) |
| `hooks/use-mobile.tsx` | Compartido | `shared/hooks/` |
| `i18n/messages.ts` | Compartido | `shared/i18n/` |
| `App.test.tsx, Dashboard.test.tsx, graphSimulator.test.ts` | **B** | tests del console |

> **Borderline a revisar manualmente**: `lib/types.ts` (¿tiene tipos de ambos productos?), `lib/mockData.ts` vs `data/sampleData.ts` (¿cuál es de A y cuál de B?), la carpeta `platform/` y `governance/` existentes del backend (abrir y distribuir contenido).

---

## 6. Cómo converge A + B (no es divorcio)

El modelo monorepo + plataforma compartida está diseñado para que A y B **converjan**, no para aislarlos. Mecanismos:

1. **Plataforma única**: A y B importan de `platform/`. Nunca se duplica persistencia, auth, tenancy, LLM. Una mejora en plataforma beneficia a ambos.
2. **Contratos compartidos**: tipos de dominio agro comunes (proveedor, departamento PY, unidad, moneda) viven en un módulo compartido, no duplicados.
3. **App factory por tier**: `app.py` monta los routers según un perfil de arranque. El MVP arranca sólo con A; el full arranca con A + B. Mismo binario, distinto perfil.
4. **Convergencia funcional futura**: cuando tenga sentido, el procurement (A) podrá invocar capacidades de predicción (B) — ej. usar el `PredictionGraph` para forecast de precios de insumos. La separación por `products/` con plataforma común hace esa integración natural, no un acople entre repos.

### Lo que NO hacemos
- No duplicar plataforma entre A y B.
- No versionar A y B por separado con dependencias cruzadas frágiles.
- No tratar B como "archivo muerto" — está dormido, no enterrado.

---

## 7. Plan de separación por fases

Prerequisito: la **Tier 1 de [restructure-plan.md](restructure-plan.md)** debe estar cerrada (paquete `agropredict`, imports actualizados, backend arrancando). La separación de productos se hace sobre esa base estable.

Cada fase es un commit independiente con su validación. Una fase rota se revierte sin perder las anteriores.

### Backend

#### Fase P1 — Crear `platform/`
1. Crear `agropredict/platform/__init__.py`
2. Mover los módulos de plataforma (ver tabla §5) a `platform/`
3. Abrir la carpeta `platform/` existente y distribuir su contenido (parte a `platform/`, parte a `products/predictions/runtime/` si es orquestación)
4. Find-replace de imports `agropredict.persistence` → `agropredict.platform.persistence`, etc.
5. Validar tests de plataforma

#### Fase P2 — Crear `products/procurement/` (Producto A)
1. Crear `agropredict/products/__init__.py`
2. Mover `procurement/` → `products/procurement/`
3. Find-replace `agropredict.procurement` → `agropredict.products.procurement`
4. Validar tests de procurement + smoke del endpoint `/api/v1/procurement`

#### Fase P3 — Crear `products/predictions/` (Producto B)
1. Mover `predictions/`, `runtime/`, `control_plane/`, `knowledge/`, `data_ingestion/`, `ml_models/`, `supply_chain/` → `products/predictions/`
2. Find-replace correspondiente
3. Validar tests de predictions

#### Fase P4 — Crear `governance/` (tier full de B)
1. Mover `billing/`, `compliance/`, `operations/`, `deployment/` + carpeta `governance/` existente → `governance/`
2. Find-replace correspondiente
3. Validar tests de governance

#### Fase P5 — App factory por tier
1. Refactor `app.py`: separar el montaje de routers en `mount_procurement(app)` y `mount_predictions(app)`
2. Introducir un setting `AGROBUY_TIER` (`mvp` | `full`) que decide qué montar
3. Validar: arranque en `mvp` sólo expone `/api/v1/procurement`; arranque en `full` expone todo

### Frontend

#### Fase F1 — Crear `shared/`
1. Mover `components/ui/`, `lib/` base, `hooks/`, `i18n/` a `shared/`
2. Actualizar imports (`@/components/ui` → `@/shared/components/ui`, etc.)
3. Validar build

#### Fase F2 — Crear `products/procurement/` (Producto A)
1. Mover `router.tsx`, `routes/`, componentes business a `products/procurement/`
2. Actualizar `main.tsx` para montar desde la nueva ubicación
3. Validar que la app corre igual que hoy

#### Fase F3 — Aislar `products/console/` (Producto B)
1. Mover `App.tsx`, componentes multi-agente, `graphSimulator`, `sampleData` a `products/console/`
2. Mover sus tests
3. Decidir el estado: ¿queda desmontado (código vivo pero no en `main.tsx`) o se agrega un entry alternativo para desarrollarlo?
4. Validar que los tests del console pasan en su nueva ubicación

#### Fase F4 — Entry selector (opcional, cuando se revele B)
1. `main.tsx` lee una env (`VITE_AGROBUY_SURFACE`) para montar el shell A o el B
2. Permite desarrollar B sin romper la demo de A

---

## 8. Decisiones pendientes

| Decisión | Opciones | Recomendación |
|---|---|---|
| Estado del frontend B tras aislarlo | (a) desmontado pero vivo, (b) entry alternativo por env, (c) ruta `/console` dentro de la misma app | (b) por env — desarrollás B sin tocar la demo de A |
| `governance/` (billing, compliance, etc.) | ¿parte de B activo o a `archive/`? | Mantener como `governance/` tier-full de B; sólo archivar si confirmás que ningún endpoint se monta |
| Naming del paquete y del título de la API | Hoy: paquete `agropredict`, título "AgroPredict AI". Producto demo: AgroBuy | Alinear: si A+B es "AgroBuy", el título de la API y el paquete deberían reflejarlo (decisión tuya) |
| `runtime/` ¿B o plataforma? | Es el motor de grafos. Hoy sólo lo usa B | Empezar en `products/predictions/runtime/`. Si el día de mañana A usa grafos, promover a `platform/` |
| `data_ingestion/` ¿B o plataforma? | ETL genérico vs pipeline de predicción | Empezar en B; promover a plataforma si A lo necesita |

---

## 9. Relación con los otros documentos

- [restructure-plan.md](restructure-plan.md): el aplanamiento `src/backend` → `agropredict` (Tier 1) y el reagrupamiento por capas (Tier 2). **Prerequisito** de este doc. Nota: la Tier 2 de ese doc proponía capas genéricas (`domains/`, `ai/`, `platform/`); este doc la **reemplaza** con una organización por producto (`products/procurement`, `products/predictions`) que es más fiel a la realidad de dos productos. Si se ejecuta esta separación, la Tier 2 del restructure-plan se considera superada por este doc.
- [deployment-strategy.md](deployment-strategy.md): por qué k8s/helm/governance enterprise están en `archive/`. Coherente: esos componentes son el "tier full" de B, congelados hasta que un trigger los reactive.

---

## 10. Resumen del orden recomendado

1. Cerrar Tier 1 de restructure-plan (paquete `agropredict` funcionando)
2. Backend: fases P1 → P5 (platform, products/procurement, products/predictions, governance, app factory)
3. Frontend: fases F1 → F4 (shared, products/procurement, products/console, entry selector)
4. Resolver decisiones pendientes (§8), sobre todo el naming AgroBuy vs AgroPredict
5. Actualizar README raíz documentando los dos productos y cómo arrancar cada tier

---

*Última actualización: agregada §2.1/§2.2 con la diferencia real verificada byte a byte contra el upstream `agro-predict-ai` (23/24 módulos backend idénticos, solo `app.py` difiere de forma aditiva, A = implementación de specs 018-021). Actualizar §5 (mapeo) si la estructura del backend cambia antes de ejecutar las fases.*

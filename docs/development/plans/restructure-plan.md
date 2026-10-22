# Plan de reestructuración — AgroBuy

> Documento operativo. Describe el proceso de reorganización del repositorio en dos tiers: **Early** (cambio mecánico, bajo riesgo) y **Full** (separación de concerns por capas). Ambos tiers son secuenciales: la Full asume que la Early está completa y validada.

---

## 1. Resumen ejecutivo

| Tier | Alcance | Riesgo | Estado actual |
|---|---|---|---|
| **Early (light reordering)** | Aplanar `backend/src/backend/` a `backend/agropredict/` y renombrar el paquete | Bajo (mecánico) | **Parcialmente ejecutado** — la carpeta fue movida pero los imports, `pyproject.toml`, `alembic/env.py` y `Dockerfile` no se actualizaron |
| **Full (separación de concerns)** | Reagrupar los 26 módulos top-level en capas (`domains/`, `ai/`, `platform/`, `integrations/`, `governance/`) | Alto (cientos de imports a actualizar) | Pendiente — bloqueado por Early |
| **Frontend (posterior)** | Reorganización feature-based, consolidación de tests y mocks | Medio | Pendiente — se aborda después de que el backend esté verde |

**Backend hoy no arranca**: los imports siguen apuntando a `backend.*` (paquete inexistente) y `Dockerfile` copia un `src/` que ya no existe. Cerrar la Tier 1 es prerequisito para cualquier desarrollo.

> **Confirmado contra el upstream (`agro-predict-ai`).** La comparación byte a byte (ver [product-separation.md §2.1](product-separation.md)) prueba que el rename `src/backend/` -> `agropredict/` es el **único cambio estructural pendiente** de la Tier 1: 23 de 24 módulos del backend son idénticos al upstream, el único archivo modificado es `app.py` (de forma aditiva: wiring de procurement + CORS), y `procurement/` es el único módulo nuevo. No hay deuda estructural oculta - solo imports/config sin actualizar tras el rename. Adicionalmente, en el upstream el paquete vive en `backend/src/backend/` (src layout estándar de PyPA); fue AgroBuy quien lo aplanó a `agropredict/` dejando el rename a medias.

---

## 2. Motivación y principios

### Por qué cambiar la estructura

- La estructura previa `backend/src/backend/` mezclaba el **src layout** de PyPA (válido para librerías Python distribuibles) con un **monorepo full-stack** (donde la subcarpeta `backend/` ya identifica el rol). El resultado era una anidación redundante visualmente y semánticamente.
- El paquete se llamaba `backend`, un nombre genérico sin identidad. Cualquier proyecto FastAPI serio en monorepo usa flat layout con un paquete nombrado por producto (ej. `backend/app/` en el [Full Stack FastAPI Template](https://github.com/fastapi/full-stack-fastapi-template), `posthog/posthog/` en PostHog, `airflow/airflow/` en Airflow).
- Adicionalmente, el paquete tiene **26 subcarpetas top-level** con responsabilidades superpuestas (`platform/`, `runtime/`, `operations/`, `deployment/`, `control_plane/`). Cualquier desarrollador nuevo tarda mucho en orientarse.

### Principios de la reestructuración

1. **Convención FastAPI monorepo**: flat layout dentro de la subcarpeta `backend/`, paquete con nombre de producto (`agropredict`).
2. **Tests fuera del paquete**: siguen en `backend/tests/`, no dentro de `backend/agropredict/tests/`.
3. **Separación de concerns por capa**: dominios de negocio aislados de infraestructura y plataforma.
4. **Cambios mínimos por paso**: cada tier deja el repo en estado funcional verificable.

---

## 3. Estado actual del repositorio

### Layout backend después de la movida parcial

```
backend/
├── pyproject.toml              # ❌ aún declara name="backend", entry "backend.app:main"
├── Dockerfile                  # ❌ copia src/ (inexistente), CMD "backend.app:app"
├── alembic.ini
├── alembic/
│   ├── env.py                  # ❌ imports "from backend.persistence.*"
│   └── versions/
├── tests/                      # tests separados, ok
│   ├── unit/
│   ├── integration/
│   ├── chaos/
│   ├── fuzz/
│   └── prompt_regression/
├── scripts/
├── models/                     # artefactos ML (.joblib)
└── agropredict/                # ✅ movido desde src/backend
    ├── (sin __init__.py verificado al momento del doc)
    ├── app.py
    ├── worker.py
    ├── config/
    ├── procurement/
    │   ├── agents/, chat/, external/, fixtures/, ml/, scoring/
    ├── predictions/
    │   ├── agents/, models/
    ├── runtime/, ml_models/, knowledge/, llm/
    ├── data_ingestion/, supply_chain/
    ├── integrations/{github, oracle_apex}/
    ├── persistence/, queue/, webhook/, credentials/, security/, tenancy/
    ├── observability/, platform/
    ├── governance/, compliance/, billing/, control_plane/
    ├── deployment/, operations/
    └── testing/
```

### Métricas del estado actual (snapshot al momento del doc)

| Métrica | Valor |
|---|---|
| Imports `from backend.X` / `import backend.X` por actualizar | **376 ocurrencias** |
| Archivos `.py` afectados por imports viejos | **145 archivos** |
| Archivos de configuración por actualizar | 3 (`pyproject.toml`, `alembic/env.py`, `Dockerfile`) |
| Subcarpetas top-level dentro de `agropredict/` | 26 |

> Los números los podés recontar con: `grep -rE "^(from backend\.|import backend\.|from backend |import backend$)" backend --include='*.py' | wc -l`

---

## 4. Tier 1 — Early (light reordering)

### Objetivo
Eliminar `src/` y renombrar el paquete a `agropredict` sin tocar la estructura interna. Resultado esperado: el backend vuelve a arrancar con `uv run uvicorn agropredict.app:app` y los tests pasan.

### Cambios incluidos (alcance acotado)
- Aplanar `backend/src/backend/` → `backend/agropredict/`
- Renombrar el paquete Python de `backend` a `agropredict`
- Actualizar `pyproject.toml`, `Dockerfile`, `alembic/env.py`
- Find-replace masivo de imports en código y tests

### Lo que NO se hace en este tier
- No se mueven módulos entre carpetas
- No se renombran archivos individuales
- No se modifica la estructura del frontend
- No se tocan `agro-predict-ai/`, `docs/`, infra de helm/k8s

### Checklist de ejecución

#### Estado al momento de redactar este doc
- [x] Mover `backend/src/backend/` → `backend/agropredict/`
- [x] Eliminar `backend/src/` (queda vacío)
- [ ] Actualizar `backend/pyproject.toml`: `name = "agropredict"`, entry point `agropredict = "agropredict.app:main"`
- [ ] Verificar/ajustar `tool.uv_build` en `pyproject.toml` para que encuentre el paquete sin `src/`
- [ ] Reemplazar imports `backend.X` → `agropredict.X` en **`backend/agropredict/`** (cuerpo del paquete)
- [ ] Reemplazar imports `backend.X` → `agropredict.X` en **`backend/tests/`**
- [ ] Actualizar `backend/alembic/env.py` (3 imports en líneas 8-10)
- [ ] Actualizar `backend/Dockerfile`: `COPY agropredict/ agropredict/` y `CMD ["uvicorn", "agropredict.app:app", ...]`
- [ ] Revisar `backend/scripts/` por referencias a `backend.X`
- [ ] Revisar `backend/conftest.py` si existe
- [ ] Verificar que no haya referencias a `backend.` en string literals (logs, configs, prompts)
- [ ] Crear `__init__.py` en `backend/agropredict/` si no existe
- [ ] Correr `uv sync` desde `backend/` para regenerar `uv.lock`
- [ ] Correr `uv run pytest` desde `backend/` y validar
- [ ] Correr `uv run uvicorn agropredict.app:app --reload` y validar healthz
- [ ] Construir imagen Docker: `docker build -t agropredict-backend ./backend`
- [ ] Verificar que `agro-predict-ai/docker-compose.yml` no apunte a paths viejos (ver sección 7)

### Comandos sugeridos

#### PowerShell (Windows, desde la raíz del repo)

```powershell
# 1. Verificar cuántos imports hay que tocar
(Get-ChildItem backend -Recurse -Filter '*.py' -Exclude '.venv','*.pyc' |
  Select-String -Pattern '^(from backend\.|import backend\.|from backend |import backend$)').Count

# 2. Find-replace masivo (DRY RUN — sólo lista archivos)
Get-ChildItem backend -Recurse -Filter '*.py' |
  Where-Object { $_.FullName -notmatch '\\\.venv\\' } |
  Select-String -Pattern '\bbackend\.' -List | Select-Object Path

# 3. Aplicar reemplazo (revisar archivos antes)
Get-ChildItem backend -Recurse -Filter '*.py' |
  Where-Object { $_.FullName -notmatch '\\\.venv\\' } |
  ForEach-Object {
    (Get-Content $_.FullName -Raw) `
      -replace '(?m)^from backend\.', 'from agropredict.' `
      -replace '(?m)^import backend\.', 'import agropredict.' `
      -replace '(?m)^from backend ', 'from agropredict ' `
      -replace '(?m)^import backend$', 'import agropredict' |
    Set-Content $_.FullName -NoNewline
  }
```

#### Bash (alternativa con `sed`)

```bash
# DRY RUN
grep -rlE "^(from backend\.|import backend\.|from backend |import backend$)" \
  backend --include='*.py'

# Aplicar
grep -rlE "^(from backend\.|import backend\.|from backend |import backend$)" \
  backend --include='*.py' |
  xargs sed -i.bak -E \
    -e 's/^from backend\./from agropredict./' \
    -e 's/^import backend\./import agropredict./' \
    -e 's/^from backend /from agropredict /' \
    -e 's/^import backend$/import agropredict/'

# Limpiar backups si todo OK
find backend -name '*.py.bak' -delete
```

> Importante: revisar manualmente los archivos antes del reemplazo. Hay riesgo de falsos positivos si en algún docstring o string literal aparece `from backend.` (poco común pero posible).

### Cambios concretos en archivos de configuración

#### `backend/pyproject.toml`

```diff
 [project]
-name = "backend"
+name = "agropredict"
 version = "0.1.0"

 [project.scripts]
-backend = "backend.app:main"
+agropredict = "agropredict.app:main"
```

Verificar también que `[tool.uv_build]` (si está) apunte al paquete correcto. Con `uv_build`, sin `src/` y el paquete en la raíz del proyecto, generalmente no hace falta config adicional — `uv_build` detecta el paquete por el `name` del proyecto.

#### `backend/alembic/env.py` (líneas 8-10)

```diff
-from backend.persistence.db import make_sync_database_url
-from backend.persistence.migrations import set_alembic_url
-from backend.persistence.schema import metadata
+from agropredict.persistence.db import make_sync_database_url
+from agropredict.persistence.migrations import set_alembic_url
+from agropredict.persistence.schema import metadata
```

#### `backend/Dockerfile`

```diff
 COPY pyproject.toml .
 COPY README.md .
 COPY alembic.ini .
 COPY alembic/ alembic/
-COPY src/ src/
+COPY agropredict/ agropredict/

 RUN uv pip install --system "uvicorn[standard]>=0.34" "psycopg[binary]>=3.2" .

 EXPOSE 8000

-CMD ["uvicorn", "backend.app:app", "--host", "0.0.0.0", "--port", "8000"]
+CMD ["uvicorn", "agropredict.app:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Validación de cierre de Tier 1

Todas estas deben pasar antes de declarar Tier 1 cerrada:

```bash
# 1. Cero imports viejos
grep -rE "^(from backend\.|import backend\.|from backend |import backend$)" \
  backend --include='*.py' | wc -l
# Esperado: 0

# 2. Compilación de bytecode
cd backend && uv run python -c "import agropredict, agropredict.app"
# Esperado: sin error

# 3. Tests
cd backend && uv run pytest -x --tb=short
# Esperado: todos pasan (o los mismos fallos que pre-rename, no nuevos)

# 4. Servidor levanta
cd backend && uv run uvicorn agropredict.app:app --port 8000
curl http://localhost:8000/healthz
# Esperado: 200 OK

# 5. Docker
docker build -t agropredict-backend ./backend
# Esperado: build exitoso

# 6. Alembic
cd backend && uv run alembic current
# Esperado: sin error de imports
```

### Riesgos y mitigaciones

| Riesgo | Probabilidad | Mitigación |
|---|---|---|
| Imports en string literals (logger config, JSON, etc.) | Baja | Buscar `"backend\."` y `'backend\.'` manualmente |
| Tests con fixtures que monkeypatchean por path | Media | Buscar `monkeypatch.setattr("backend.` en tests |
| `pyproject.toml` con paths explícitos a `src/` | Media | Verificar `[tool.uv_build]`, `[tool.pytest]`, `[tool.ruff]`, `[tool.coverage]` |
| Scripts externos (CI, makefile) referencian `backend.app` | Media | Buscar en `Makefile`, `.github/workflows/`, `agro-predict-ai/scripts/` |
| Stub files `.pyi` o type stubs | Baja | Buscar `*.pyi` en `backend/` |

### Rollback

Mientras la Tier 1 no esté commiteada:

```bash
git restore backend/
git clean -fd backend/
```

Si ya está commiteada y aparecen errores tarde: `git revert <sha>` y volver a empezar.

---

## 5. Tier 2 — Full (separación de concerns)

### Objetivo
Reorganizar las 26 subcarpetas de `backend/agropredict/` en 5 capas claras: `domains/`, `ai/`, `platform/`, `integrations/`, `governance/`. Resultado esperado: navegabilidad significativamente mayor, responsabilidades explícitas, código equivalente funcionalmente.

> **Superado por la separación de productos.** Esta Tier 2 propone capas genéricas (`domains/`, `ai/`, `platform/`). Tras confirmar que el repo contiene dos productos (A procurement + B plataforma) sobre una base común, [product-separation.md](product-separation.md) la **reemplaza** con una organización por producto (`platform/` + `products/{procurement,predictions}` + `governance/`), más fiel a la realidad. Si se ejecuta la separación de productos, esta Tier 2 se considera obsoleta; se conserva acá como registro de la alternativa evaluada. La Tier 1 (rename) sigue siendo prerequisito de ambas.

### Prerequisito
**La Tier 1 debe estar completa, validada y commiteada.** No se inicia la Tier 2 con el backend roto.

### Diseño target

```
backend/
├── pyproject.toml, Dockerfile, alembic.ini, README.md
├── alembic/, tests/, scripts/, models/
└── agropredict/
    ├── __init__.py
    ├── app.py                       # FastAPI factory + bootstrap
    ├── config/                      # Pydantic Settings (env vars)
    │
    ├── domains/                     # lógica de negocio por dominio
    │   ├── procurement/             # compras — pipeline vanilla (spec 019)
    │   │   ├── agents/              # Comparator, Recommender
    │   │   ├── chat/                # chat copilot endpoints
    │   │   ├── external/            # weather, FX, departments
    │   │   ├── fixtures/            # seed demo data
    │   │   ├── ml/                  # supplier predictor + anomaly
    │   │   └── scoring/             # urgency, offer, decision matrix
    │   ├── predictions/             # predicciones — LangGraph StateGraph
    │   │   ├── agents/              # Aline, Mila, Nico, Sofia, Ravi
    │   │   └── models/
    │   └── supply_chain/            # dominio supply chain
    │
    ├── ai/                          # capa IA transversal
    │   ├── runtime/                 # workflow general (StateGraph orquestación)
    │   ├── ml_models/               # ML compartido entre dominios
    │   ├── knowledge/               # RAG / knowledge base
    │   └── llm/                     # cliente LLM, prompt loader
    │
    ├── platform/                    # núcleo plataforma (cross-cutting)
    │   ├── persistence/             # SQLAlchemy + sessions
    │   ├── queue/                   # workers ARQ + Redis
    │   ├── webhook/                 # endpoints webhook entrantes
    │   ├── data_ingestion/          # ETL/ingesta externos
    │   ├── security/                # auth, JWT, encryption
    │   ├── credentials/             # secrets, KMS
    │   ├── tenancy/                 # multi-tenant + RLS
    │   └── observability/           # logs, traces, metrics
    │
    ├── integrations/                # adaptadores a sistemas externos
    │   ├── github/
    │   └── oracle_apex/
    │
    ├── governance/                  # control + compliance
    │   ├── governance/              # políticas internas
    │   ├── compliance/              # regulatorio
    │   ├── billing/                 # planes, uso
    │   ├── control_plane/           # admin interno
    │   ├── deployment/              # config deploy
    │   └── operations/              # runbooks, alertas
    │
    └── testing/                     # helpers/fixtures de tests
```

### Mapeo módulo actual → destino

| Origen (`agropredict/`) | Destino (`agropredict/`) |
|---|---|
| `procurement/` | `domains/procurement/` |
| `predictions/` | `domains/predictions/` |
| `supply_chain/` | `domains/supply_chain/` |
| `runtime/` | `ai/runtime/` |
| `ml_models/` | `ai/ml_models/` |
| `knowledge/` | `ai/knowledge/` |
| `llm/` | `ai/llm/` |
| `persistence/` | `platform/persistence/` |
| `queue/` | `platform/queue/` |
| `webhook/` | `platform/webhook/` |
| `data_ingestion/` | `platform/data_ingestion/` |
| `security/` | `platform/security/` |
| `credentials/` | `platform/credentials/` |
| `tenancy/` | `platform/tenancy/` |
| `observability/` | `platform/observability/` |
| `integrations/github/` | `integrations/github/` (sin cambios) |
| `integrations/oracle_apex/` | `integrations/oracle_apex/` (sin cambios) |
| `governance/` | `governance/governance/` |
| `compliance/` | `governance/compliance/` |
| `billing/` | `governance/billing/` |
| `control_plane/` | `governance/control_plane/` |
| `deployment/` | `governance/deployment/` |
| `operations/` | `governance/operations/` |
| `platform/` | **revisar** — distribuir su contenido entre `platform/` y `ai/runtime/` |
| `testing/` | `testing/` (sin cambios) |
| `config/` | `config/` (sin cambios) |
| `app.py`, `worker.py` | quedan en raíz del paquete |

> Nota sobre `platform/` (la subcarpeta vieja): hay que abrirla y decidir archivo por archivo. Probablemente algunos archivos son orquestación (van a `ai/runtime/`) y otros son infra (van a la nueva `platform/`).

### Plan de migración por fases

La Tier 2 se ejecuta en **5 fases independientes**, cada una con su commit y validación. Esto reduce el blast radius: si una fase rompe algo, se revierte sin perder el resto.

#### Fase 2.1 — `domains/`
1. Crear `agropredict/domains/__init__.py`
2. Mover `procurement/`, `predictions/`, `supply_chain/` → `agropredict/domains/`
3. Find-replace: `agropredict.procurement` → `agropredict.domains.procurement` (idem predictions, supply_chain)
4. Validar tests del dominio

#### Fase 2.2 — `ai/`
1. Crear `agropredict/ai/__init__.py`
2. Mover `runtime/`, `ml_models/`, `knowledge/`, `llm/` → `agropredict/ai/`
3. Find-replace correspondiente
4. Validar tests de pipeline IA y predictions

#### Fase 2.3 — `platform/`
1. **Renombrar** `agropredict/platform/` viejo a `agropredict/_platform_legacy/` temporalmente para evitar colisión
2. Crear nueva `agropredict/platform/`
3. Mover `persistence/`, `queue/`, `webhook/`, `data_ingestion/`, `security/`, `credentials/`, `tenancy/`, `observability/` → `agropredict/platform/`
4. Abrir `_platform_legacy/` y distribuir su contenido (típicamente: lo que orquesta runs/agents va a `ai/runtime/`, lo que es core API/middleware va a la nueva `platform/`)
5. Eliminar `_platform_legacy/` cuando esté vacío
6. Find-replace correspondiente
7. Validar tests de persistencia, workers, webhooks

#### Fase 2.4 — `governance/`
1. **Renombrar** `agropredict/governance/` viejo a `agropredict/_governance_legacy/` temporalmente
2. Crear nueva `agropredict/governance/`
3. Mover `_governance_legacy/`, `compliance/`, `billing/`, `control_plane/`, `deployment/`, `operations/` → `agropredict/governance/`
4. Renombrar `_governance_legacy/` a `agropredict/governance/governance/`
5. Find-replace correspondiente
6. Validar tests de billing, compliance, control plane

#### Fase 2.5 — Limpieza
1. `integrations/` queda como está
2. Verificar que no quede ninguna carpeta huérfana en la raíz del paquete
3. Actualizar `README.md` del backend con el nuevo árbol
4. Correr suite completa
5. Construir imagen Docker
6. Commit final + tag

### Validación de cierre de Tier 2

```bash
# 1. Estructura esperada
test -d backend/agropredict/domains/procurement
test -d backend/agropredict/ai/runtime
test -d backend/agropredict/platform/persistence
test -d backend/agropredict/governance/billing
test -d backend/agropredict/integrations/github

# 2. Cero imports a paths viejos
grep -rE "agropredict\.(procurement|predictions|supply_chain|runtime|ml_models|knowledge|llm|persistence|queue|webhook|data_ingestion|security|credentials|tenancy|observability|compliance|billing|control_plane|deployment|operations)\b" \
  backend --include='*.py' | \
  grep -vE "agropredict\.(domains|ai|platform|integrations|governance)\." | wc -l
# Esperado: 0

# 3. Tests
cd backend && uv run pytest

# 4. Servidor
cd backend && uv run uvicorn agropredict.app:app --port 8000
curl http://localhost:8000/healthz
```

### Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Imports circulares al reagrupar (un dominio importa de `platform/` y viceversa) | Inspeccionar grafo de imports antes de cada fase; si hay ciclo, extraer interfaces a un módulo `core/` |
| Tests rotos masivamente | Una fase por commit; si una rompe, se revierte sin tocar las anteriores |
| Alembic con paths que no se pueden mover (migraciones referencian modelos por full-path) | Verificar `target_metadata` en `env.py`; las migraciones generadas no deberían cambiar |
| Scripts CI/CD apuntando a paths viejos | Revisar `.github/workflows/`, `Makefile`, `docker-compose.yml`, `helm/`, `k8s/` antes del merge |

---

## 6. Frontend (después del backend)

Una vez que la Tier 2 del backend esté cerrada, se aborda el frontend. Cambios principales:

- Agrupar componentes por feature en `src/features/`
- Consolidar tests dispersos en `frontend/tests/`
- Consolidar mocks (`src/data/sampleData.ts` + `src/lib/mockData.ts`) en `src/lib/mocks/`
- Mantener `src/routes/` (file-based routing de TanStack — no se toca)

Layout target:

```
frontend/
├── package.json, vite.config.ts, tsconfig.json, index.html
├── public/
├── tests/                           # consolidado
│   ├── setup.ts
│   ├── App.test.tsx
│   ├── Dashboard.test.tsx
│   └── graphSimulator.test.ts
└── src/
    ├── main.tsx, App.tsx, router.tsx, routeTree.gen.ts, vite-env.d.ts
    ├── routes/                      # TanStack file-based (no tocar)
    ├── features/
    │   ├── agents/                  # AgentHealthPanel, DynamicPixelOffice, FlowSimulator
    │   ├── predictions/             # PredictionList
    │   ├── chat/                    # ChatPanel
    │   └── admin/                   # FeatureFlagManager, TenantManager
    ├── components/                  # AppHeader, AppSidebar, PageShell, Pills, + ui/
    ├── hooks/
    ├── lib/
    │   ├── api.ts, types.ts, format.ts, utils.ts, role.tsx
    │   ├── graphSimulator.ts, graphValidation.ts
    │   └── mocks/
    │       ├── sampleData.ts
    │       └── mockData.ts
    └── i18n/
```

Plan detallado del frontend: se redacta cuando llegue el momento. Por ahora basta con saber que viene después.

---

## 7. Tareas transversales (independientes de los tiers)

Estas se pueden ejecutar en paralelo, no bloquean ni son bloqueadas por los tiers:

### Saneamiento del repositorio
- [ ] Crear `.gitignore` raíz (Python `.venv/`, `__pycache__/`, `.pytest_cache/`, `.ruff_cache/`, `.hypothesis/`; Node `node_modules/`, `dist/`, `.vite/`; OS `Thumbs.db`, `.DS_Store`; editor `.idea/`, `.vscode/` selectivo)
- [ ] `git rm --cached -r backend/.venv frontend/node_modules` para sacar del tracking sin borrar local
- [ ] Eliminar `agro-predict-ai/frontend-forge-main/` (skeleton TanStack Start abandonado, ya confirmado)
- [ ] Confirmar y eliminar carpetas vacías: `compras/` raíz, `docs/epipy/`, `docs/duediligence/`, `docs/logistica/`

### `agro-predict-ai/` — destino
Una vez Tier 1 cerrada, ese directorio queda casi vacío de contenido propio. Hay dos opciones:

**Opción A — Disolver `agro-predict-ai/`:**
- Mover `agro-predict-ai/docker-compose.yml` → raíz, ajustar paths `./backend` y `./frontend`
- Mover `agro-predict-ai/contracts/openapi/` → `backend/contracts/openapi/` o raíz `contracts/`
- Mover `agro-predict-ai/{helm, k8s, operations, scripts, openspec, .specify}/` → raíz
- Borrar `agro-predict-ai/`

**Opción B — Mantener `agro-predict-ai/` como subdirectorio de infra:**
- Renombrar a `infra/` o `deploy/` para clarificar el propósito
- Mantener helm/k8s/operations adentro
- Mover `docker-compose.yml` a raíz igual

Recomendación: Opción A si querés un repo plano clásico; B si preferís separar código de infra. Decisión pendiente — no bloquea los tiers.

---

## 8. Apéndice — Comandos útiles

### Contar trabajo restante en cualquier momento

```bash
# Imports viejos a 'backend.X'
grep -rcE "^(from backend\.|import backend\.|from backend |import backend$)" \
  backend --include='*.py' | grep -v ':0$' | wc -l

# Imports a paths planos (post-Tier 1, pre-Tier 2)
grep -rcE "from agropredict\.(procurement|predictions|runtime|persistence|...)\." \
  backend --include='*.py' | wc -l
```

### Verificar que no se usen paths viejos en strings

```bash
# String literals "backend." en cualquier archivo
grep -rE '"backend\.' backend --include='*.py'
grep -rE "'backend\." backend --include='*.py'

# YAML, JSON, TOML
grep -rE 'backend\.' backend --include='*.yml' --include='*.yaml' --include='*.json' --include='*.toml'
```

### Limpiar caches después de un rename

```bash
find backend -type d -name '__pycache__' -exec rm -rf {} +
find backend -type d -name '.pytest_cache' -exec rm -rf {} +
find backend -type d -name '.ruff_cache' -exec rm -rf {} +
```

---

## 9. Gotchas conocidos

| Gotcha | Detalle |
|---|---|
| `uv_build` y src layout | Sin `src/`, `uv_build` busca el paquete por `name` en `pyproject.toml`. Asegurarse de que `name = "agropredict"` y la carpeta `agropredict/` esté al mismo nivel que `pyproject.toml`. |
| `__init__.py` faltante | Después de mover/crear carpetas, verificar que cada paquete tenga su `__init__.py`. Sin él, Python 3 lo trata como namespace package y rompe imports relativos. |
| Type stubs y `py.typed` | Si el paquete distribuye type info, agregar `agropredict/py.typed` (archivo vacío). |
| Caches en `.pyc` | Después de cambios masivos, borrar `__pycache__/` para evitar import de bytecode obsoleto. |
| IDE auto-imports | VS Code / PyCharm pueden auto-completar con `backend.` por algunos minutos después del cambio. Reiniciar el language server. |
| Alembic `target_metadata` | Si `env.py` apunta a `agropredict.persistence.schema:metadata`, asegurarse de que el módulo se importe sin side effects que rompan el contexto de alembic. |
| Path environment | Si hay shells abiertos con `PYTHONPATH=src/`, cerrarlos. |

---

## 10. Resumen del orden recomendado

1. **Cerrar Tier 1** (imports + pyproject + alembic + Dockerfile + validación)
2. **Commit** y push
3. **Saneamiento transversal**: `.gitignore`, eliminar `frontend-forge-main/`, decidir destino de `agro-predict-ai/`
4. **Tier 2 fase por fase**, una fase por commit, validando entre cada una
5. **Frontend** una vez backend verde
6. **Documentación final**: actualizar `README.md` raíz con instrucciones de quickstart contra la nueva estructura

---

*Última actualización: este doc refleja el estado al momento de su creación. Después de cualquier avance, actualizar la sección 3 (estado actual) y la checklist de la sección 4.*

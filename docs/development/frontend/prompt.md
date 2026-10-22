Build a procurement copilot dashboard called "AgroBuy" for Paraguayan agricultural cooperatives. It is the
  buyer-facing UI of a system that lets cooperatives request quotations, compare offers, and receive AI-driven
  recommendations.

  CONTEXT
  The user is the purchasing analyst at "Cooperativa Coopagro" in Itapúa, Paraguay. They buy fertilizers, seeds, and
  agrochemicals for their member farmers. The app talks to a FastAPI backend at http://localhost:8000 (REST, JSON).

  TARGET AUDIENCE
  Spanish-speaking. Paraguayan agro vocabulary: zafra, ventana fenológica, urea, soja, fertilizante, cooperativa, socios
   productores. Tone: professional but warm, not corporate SaaS.

  VISUAL STYLE
  - Palette: forest green primary (#15803d, #22c55e), warm earth accent (#a16207), amber for warnings (#f59e0b), red for
   critical errors. Off-white background (#fafaf9), not pure white. NO corporate blue.
  - Typography: Inter (or Plus Jakarta Sans). Headings 600-700, body 400-500. Numbers and KPIs slightly larger and
  bolder.
  - Cards with soft shadow and 14px radius. Plenty of whitespace but data-dense when needed.
  - Lucide icons. Rural touches where natural (Sprout, Cloud, Truck, Wheat).
  - Header subline: "Cooperativa Coopagro · Itapúa, Paraguay · Campaña 2026/27"
  - Subtle texture or gradient on the sidebar (forest green to slightly darker), not flat.

  PAGES (left sidebar navigation)
  1. Inbox — list of purchase requests
  2. Nueva solicitud — create a request
  3. Detalle de solicitud — request + quotations + actions
  4. Cargar cotización — upload/paste a quotation
  5. Comparar y recomendar — the star page
  6. Catálogo de proveedores
  7. Dashboard ejecutivo — KPIs

  ROLE SWITCHER
  Top-right of the header has a role pill that toggles between: Solicitante, Comprador, Aprobador, Director. Each role
  hides/shows different actions but the visual stays consistent.

  PAGE 1 — INBOX
  - Header: "Solicitudes activas" + count badge
  - KPI strip with 4 cards: solicitudes activas, monto en proceso (Gs.), pendientes de aprobación, tiempo promedio de
  cierre (días)
  - Filter pills: Estado, Cultivo (soja, maíz, trigo, sorgo), Departamento, Urgencia
  - Table/cards (use cards on small screens, table on wide). Each row shows: title, target_crop with icon,
  fenological_window pill, urgency pill (color-coded), days to deadline, total estimated, status pill, action arrow.
  - Click a row → page 3.

  PAGE 2 — NUEVA SOLICITUD
  Form sections:
  - Datos generales: title, descripción, categoría select
  (fertilizante/semilla/fitosanitario/maquinaria/repuesto/combustible).
  - Contexto agro: cultivo destino, zafra, ventana fenológica, hectáreas a cubrir, departamento de entrega.
  - Plazo y presupuesto: fecha límite, presupuesto estimado, urgencia radio.
  - Pesos de evaluación: 4 sliders (precio, plazo, calidad, condiciones) that must sum to 100. Show a live total badge
  that turns red when ≠ 100.
  - Items: master-detail editable table with descripción, cantidad, unidad, especificaciones, precio target.
  - Two buttons: "Guardar borrador" (secondary) and "Publicar solicitud" (primary green).

  PAGE 3 — DETALLE DE SOLICITUD
  Layout: two columns on desktop.
  - Left column: solicitud summary card + items list.
  - Right column: cotizaciones table with columns: proveedor, total normalizado (Gs.), plazo (días), garantía (meses),
  ML score (colored band: green ≥ 80, amber 60-79, red < 60), anomaly icon ⚠️ when flagged. Hover the anomaly icon shows
   the reason.
  - Top of right column: "Cargar cotización" button (primary).
  - Bottom action bar (sticky): "Comparar cotizaciones" (enabled when ≥ 2 validated), "Generar recomendación" (enabled
  after compare).

  PAGE 4 — CARGAR COTIZACIÓN
  - Two-tab interface: "Pegar texto" (textarea, default tab) and "Subir archivo" (drag-and-drop for PDF/Excel/image,
  MVP-stub).
  - Selector de proveedor: combobox with existing tenant suppliers + option "+ Nuevo proveedor".
  - "Procesar con IA" button. Shows a 3-second loading state with messages cycling: "Analizando con IA…" → "Detectando
  moneda y plazos…" → "Validando datos…".
  - Result shown below as an editable form pre-filled with the LLM extraction. Highlight low-confidence fields with a
  warning border. "Confirmar y guardar" button at bottom.

  PAGE 5 — COMPARAR Y RECOMENDAR (star page)
  This is THE page. Three regions stacked.

  Region 1 — Tabla comparativa normalizada
  - Header row: each supplier (name + ML confidence band).
  - Data rows: items unificados, total PYG normalizado, plazo, garantía, condiciones de pago, ML p_on_time, anomaly
  score.
  - Highlight cells: best price in green, fastest in blue, anomalies with ⚠️ amber.
  - Footer row: "Mejor en cada criterio" with chips per criterion.

  Region 2 — Recomendación generada (rendered Markdown card)
  - Big header: "Recomendación: <Proveedor> · <decision_band pill>".
  - Composite score as a circular progress widget (0-100).
  - Two side-by-side score cards: Urgency Score with weather/delivery/volatility breakdown bars; Offer Score with
  supplier/terms/delivery_risk breakdown bars.
  - Justification, alternatives considered, and risks identified rendered from Markdown.
  - Buttons: "Ajustar criterios" (re-score with new weights, secondary), "Aceptar recomendación" (primary green).

  Region 3 — Generador de mensaje de negociación
  - Inline form: select supplier (default: recommended), checkboxes for what to improve (precio %, plazo días, garantía
  meses), tone radio (cordial / formal / asertivo).
  - "Generar mensaje" button. Shows a 2-second loading.
  - Generated message displays in a styled email card (read-only first, then "Editar" toggles to textarea). Buttons:
  "Copiar al portapapeles" and "Marcar como enviado".

  PAGE 6 — CATÁLOGO DE PROVEEDORES
  - Card grid. Each supplier card: legal_name, RUC, primary_categories chips, ML p_on_time as a colored circular badge,
  on_time_rate histórico, # cotizaciones recibidas, # adjudicaciones, last_activity badge.
  - Click a card → drill-down with full performance history chart.

  PAGE 7 — DASHBOARD EJECUTIVO
  - 4 KPI hero cards at top: Gs. comprado este mes, % ahorro vs presupuesto, cycle time promedio, solicitudes
  adjudicadas.
  - Line chart: gasto mensual últimos 12 meses (Recharts).
  - Pie chart: gasto por categoría agro.
  - Two side-by-side tables: Top 5 proveedores adjudicados, Top 5 proveedores con mejor ML score.
  - Anomaly alerts banner if any flagged quotations exist this month.

  API CONTRACTS (use fetch with json bodies)
  - GET /api/v1/procurement/requests?tenant_id=tenant-coopagro&team_id=team-compras
  - POST /api/v1/procurement/requests (body: PurchaseRequestCreate)
  - GET /api/v1/procurement/requests/{id}/quotations?tenant_id=tenant-coopagro
  - POST /api/v1/procurement/quotations (body: QuotationCreate)
  - POST /api/v1/procurement/quotations/extract (body: { raw_text: string, request_id: string, tenant_id: string })  —
  returns ExtractedQuotation preview
  - POST /api/v1/procurement/requests/{id}/recommend  — returns Recommendation
  - POST /api/v1/procurement/quotations/{id}/negotiate (body: { target_improvements: object, tone: string })  — returns
  NegotiationMessage
  - GET /api/v1/procurement/weather/risk?department=Itapua&horizon_days=10
  - GET /api/v1/procurement/fx/usd_pyg
  - GET /api/v1/procurement/suppliers?tenant_id=tenant-coopagro

  For the demo, hardcode tenant_id="tenant-coopagro", team_id="team-compras" and the active user as "Ana Rojas
  (comprador@coopagro.coop.py)".

  DEMO DATA
  Pre-seed the inbox with 5 fake requests. The hero one is "Compra de 800 ton de urea 46% para zafra soja 26/27" with 4
  quotations from suppliers: Proveedor Agro 1 S.A., Proveedor Agro 4, Proveedor Agro 2, Proveedor Agro 3. Proveedor Agro 2 should display
  an anomaly flag (price 18% below market). Proveedor Agro 1 should have the highest ML p_on_time (0.92) and be the
  recommendation.

  ACCESSIBILITY
  - All interactive elements keyboard-reachable.
  - Anomaly and ML status are NEVER color-only — always icon + text label.
  - AA contrast on all text.
  - Respect prefers-reduced-motion.

  DELIVERABLES
  React + Vite + TypeScript + Tailwind. Tanstack Query for data fetching. Recharts for charts. shadcn/ui or Headless UI
  for primitives. No backend mock library — call the FastAPI directly with fetch. Provide a .env.example with
  VITE_API_BASE=http://localhost:8000.

  Build all 7 pages. Make page 5 (Comparar y recomendar) the showcase — it should look impressive enough to anchor a
  90-second hackathon demo.
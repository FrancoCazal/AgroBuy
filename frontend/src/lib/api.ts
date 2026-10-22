import { REQUESTS, QUOTATIONS, SUPPLIERS, RECOMMENDATION } from "./mockData";
import type {
  PurchaseRequest,
  Quotation,
  Supplier,
  Recommendation,
  NegotiationMessage,
  ChatActionLink,
  ChatMessageResponse,
  Crop,
  Category,
  Urgency,
  Status,
} from "./types";

const API_BASE = (import.meta as any).env?.VITE_API_BASE || "http://localhost:8000";
export const TENANT_ID = "tenant-coopagro";
export const TEAM_ID = "team-compras";
export const CURRENT_USER = { name: "Juan Perez", email: "jperez@coopagro.coop.py", role: "Comprador" };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function tryFetch<T>(
  path: string,
  init?: RequestInit,
  fallback?: () => T | Promise<T>,
  timeoutMs = 8000,
): Promise<T> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      signal: ctrl.signal,
      headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    });
    clearTimeout(t);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } catch {
    if (fallback) return fallback();
    throw new Error("API offline");
  }
}

// ---------------------------------------------------------------------------
// Backend -> frontend shape adapters.
// The FastAPI procurement service emits its own field names and enum values
// (e.g. `request_id`, `target_zafra`, `urgency: "urgente"`, `status: "in_quoting"`)
// while the React UI was written against the `frontend-forge-main` shape
// (`id`, `zafra`, `urgency: "alta"`, `status: "en_evaluacion"`).
// We translate at the API boundary so the rest of the app keeps working.
// ---------------------------------------------------------------------------

function toNumber(value: unknown, fallback = 0): number {
  if (value === null || value === undefined || value === "") return fallback;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeCrop(value: unknown): Crop {
  const v = String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
  if (["soja", "maiz", "trigo", "sorgo", "girasol", "arroz"].includes(v)) {
    return v as Crop;
  }
  return "soja";
}

function normalizeCategory(value: unknown): Category {
  const v = String(value ?? "").toLowerCase();
  if (["fertilizante", "semilla", "fitosanitario", "maquinaria", "repuesto", "combustible"].includes(v)) {
    return v as Category;
  }
  return "fertilizante";
}

function normalizeUrgency(value: unknown): Urgency {
  const v = String(value ?? "").toLowerCase();
  if (v === "critica") return "critica";
  if (v === "urgente") return "alta";       // backend "urgente" -> UI "alta"
  if (v === "normal") return "media";       // backend "normal"  -> UI "media"
  if (["baja", "media", "alta"].includes(v)) return v as Urgency;
  return "media";
}

function normalizeStatus(value: unknown): Status {
  const v = String(value ?? "").toLowerCase();
  // Backend StrEnum values -> UI labels
  switch (v) {
    case "draft":
      return "borrador";
    case "in_quoting":
      return "publicada";
    case "ready_for_review":
    case "recommended":
      return "en_evaluacion";
    case "approved":
      return "adjudicada";
    case "closed":
      return "cerrada";
    case "cancelled":
      return "cancelada";
    default:
      // Already in UI vocabulary (mock data path) or unknown.
      if (
        ["borrador", "publicada", "en_evaluacion", "adjudicada", "cerrada", "cancelada"].includes(v)
      ) {
        return v as Status;
      }
      return "publicada";
  }
}

function normalizeRequest(raw: any): PurchaseRequest {
  // Backend shape uses request_id / target_zafra / target_delivery_date /
  // budget_cap / target_hectares / delivery_department. Mock shape uses
  // id / zafra / deadline / budget_pyg / hectares / department.
  const id = raw.id ?? raw.request_id ?? "";
  const items = Array.isArray(raw.items)
    ? raw.items.map((it: any, idx: number) => ({
        id: it.id ?? it.item_id ?? `item-${idx}`,
        description: it.description ?? "",
        quantity: toNumber(it.quantity),
        unit: it.unit ?? "",
        specs: it.specs ?? it.specifications,
        target_price: toNumber(it.target_price ?? it.target_price_unit, 0) || undefined,
      }))
    : [];
  return {
    id,
    title: raw.title ?? "",
    description: raw.description ?? "",
    category: normalizeCategory(raw.category),
    target_crop: normalizeCrop(raw.target_crop),
    zafra: raw.zafra ?? raw.target_zafra ?? "",
    fenological_window: raw.fenological_window ?? "",
    hectares: toNumber(raw.hectares ?? raw.target_hectares),
    department: raw.department ?? raw.delivery_department ?? "",
    deadline: raw.deadline ?? raw.target_delivery_date ?? new Date().toISOString(),
    budget_pyg: toNumber(raw.budget_pyg ?? raw.budget_cap),
    urgency: normalizeUrgency(raw.urgency),
    status: normalizeStatus(raw.status),
    weights:
      raw.weights ??
      (raw.criteria_weights
        ? {
            precio: toNumber(raw.criteria_weights.price ?? raw.criteria_weights.precio, 0.4),
            plazo: toNumber(raw.criteria_weights.delivery ?? raw.criteria_weights.plazo, 0.3),
            calidad: toNumber(raw.criteria_weights.quality ?? raw.criteria_weights.calidad, 0.2),
            condiciones: toNumber(
              raw.criteria_weights.terms ?? raw.criteria_weights.condiciones,
              0.1,
            ),
          }
        : { precio: 0.4, plazo: 0.3, calidad: 0.2, condiciones: 0.1 }),
    items,
    created_at: raw.created_at ?? new Date().toISOString(),
    created_by: raw.created_by ?? raw.requested_by ?? "system",
  };
}

function normalizeQuotation(raw: any): Quotation {
  return {
    id: raw.id ?? raw.quotation_id ?? "",
    request_id: raw.request_id ?? "",
    supplier_id: raw.supplier_id ?? "",
    supplier_name: raw.supplier_name ?? raw.supplier_legal_name ?? raw.supplier_id ?? "",
    total_pyg: toNumber(raw.total_pyg ?? raw.total_amount),
    total_normalized_pyg: toNumber(
      raw.total_normalized_pyg ?? raw.total_pyg_normalized ?? raw.total_amount,
    ),
    currency: raw.currency === "USD" ? "USD" : "PYG",
    delivery_days: toNumber(raw.delivery_days ?? raw.lead_time_days),
    warranty_months: toNumber(raw.warranty_months),
    payment_terms: raw.payment_terms ?? "",
    ml_score: toNumber(raw.ml_score, 60),
    ml_p_on_time: toNumber(raw.ml_p_on_time, 0.8),
    anomaly_flag: Boolean(raw.anomaly_flag),
    anomaly_reason: raw.anomaly_reason,
    confidence: toNumber(raw.confidence, 0.85),
    items: Array.isArray(raw.items)
      ? raw.items.map((it: any) => ({
          description: it.description ?? "",
          quantity: toNumber(it.quantity),
          unit_price_pyg: toNumber(it.unit_price_pyg ?? it.unit_price),
          total: toNumber(it.total ?? it.subtotal),
        }))
      : [],
    created_at: raw.created_at ?? new Date().toISOString(),
  };
}

function normalizeSupplier(raw: any): Supplier {
  return {
    id: raw.id ?? raw.supplier_id ?? "",
    legal_name: raw.legal_name ?? "",
    ruc: raw.ruc ?? "",
    primary_categories: Array.isArray(raw.primary_categories)
      ? (raw.primary_categories.map(normalizeCategory) as Category[])
      : typeof raw.primary_categories === "string"
        ? (raw.primary_categories
            .split(",")
            .map((s: string) => s.trim())
            .filter(Boolean)
            .map(normalizeCategory) as Category[])
        : [],
    ml_p_on_time: toNumber(raw.ml_p_on_time, 0.8),
    on_time_rate: toNumber(raw.on_time_rate, 0.85),
    quotations_received: toNumber(raw.quotations_received),
    awards: toNumber(raw.awards),
    last_activity: raw.last_activity ?? new Date().toISOString(),
  };
}

export const api = {
  listRequests: async () => {
    const raw = await tryFetch<any[]>(
      `/api/v1/procurement/requests?tenant_id=${TENANT_ID}&team_id=${TEAM_ID}`,
      undefined,
      () => REQUESTS as any[],
    );
    return raw.map(normalizeRequest);
  },

  getRequest: async (id: string) => {
    const all = await api.listRequests();
    return all.find((r) => r.id === id);
  },

  createRequest: async (body: Partial<PurchaseRequest>) => {
    const raw = await tryFetch<any>(
      `/api/v1/procurement/requests`,
      {
        method: "POST",
        body: JSON.stringify({
          ...body,
          tenant_id: TENANT_ID,
          team_id: TEAM_ID,
          requested_by: CURRENT_USER.email,
        }),
      },
      async () => {
        await sleep(400);
        return {
          ...(body as PurchaseRequest),
          id: `pr-${Date.now()}`,
          status: "publicada",
          created_at: new Date().toISOString(),
        };
      },
    );
    return normalizeRequest(raw);
  },

  listQuotations: async (requestId: string) => {
    const raw = await tryFetch<any[]>(
      `/api/v1/procurement/requests/${requestId}/quotations?tenant_id=${TENANT_ID}`,
      undefined,
      () => QUOTATIONS.filter((q) => q.request_id === requestId) as any[],
    );
    return raw.map(normalizeQuotation);
  },

  createQuotation: async (body: Partial<Quotation>) => {
    const raw = await tryFetch<any>(
      `/api/v1/procurement/quotations`,
      { method: "POST", body: JSON.stringify({ ...body, tenant_id: TENANT_ID }) },
      async () => {
        await sleep(500);
        return {
          ...(body as Quotation),
          id: `q-${Date.now()}`,
          created_at: new Date().toISOString(),
        };
      },
    );
    return normalizeQuotation(raw);
  },

  extractQuotation: (raw_text: string, request_id: string) =>
    tryFetch<Partial<Quotation>>(
      `/api/v1/procurement/quotations/extract`,
      { method: "POST", body: JSON.stringify({ raw_text, request_id, tenant_id: TENANT_ID }) },
      async () => {
        await sleep(2800);
        const totalMatch = raw_text.match(/(?:total|monto)[^\d]*([\d.,]+)/i);
        const total = totalMatch
          ? Number(totalMatch[1].replace(/\./g, "").replace(",", "."))
          : 5_300_000_000;
        const daysMatch = raw_text.match(/(\d{1,3})\s*d[ií]as/i);
        return {
          supplier_name: "Proveedor detectado",
          total_pyg: total,
          total_normalized_pyg: total,
          currency: "PYG",
          delivery_days: daysMatch ? Number(daysMatch[1]) : 18,
          warranty_months: 12,
          payment_terms: "30/60 días",
          confidence: 0.78,
          items: [{ description: "Item extraído (revisar)", quantity: 1, unit_price_pyg: total, total }],
        };
      },
    ),

  recommend: (requestId: string) =>
    tryFetch<Recommendation>(
      `/api/v1/procurement/requests/${requestId}/recommend?tenant_id=${TENANT_ID}`,
      { method: "POST" },
      async () => {
        await sleep(1200);
        return RECOMMENDATION;
      },
      60000,
    ),

  negotiate: (quotationId: string, target_improvements: Record<string, unknown>, tone: string) =>
    tryFetch<NegotiationMessage>(
      `/api/v1/procurement/quotations/${quotationId}/negotiate`,
      { method: "POST", body: JSON.stringify({ target_improvements, tone, tenant_id: TENANT_ID }) },
      async () => {
        await sleep(1800);
        const toneOpening: Record<string, string> = {
          cordial: "Estimados, espero se encuentren muy bien.",
          formal: "Estimados Sres.,",
          asertivo: "Estimados,",
        };
        const improvements: string[] = [];
        if (target_improvements.precio) improvements.push(`una mejora de precio del ${target_improvements.precio}%`);
        if (target_improvements.plazo) improvements.push(`reducir el plazo de entrega en ${target_improvements.plazo} días`);
        if (target_improvements.garantia) improvements.push(`extender la garantía a ${target_improvements.garantia} meses`);
        return {
          supplier_id: "sup-agro1",
          subject: "Solicitud de revisión de cotización — Urea zafra 26/27",
          body: `${toneOpening[tone] || toneOpening.cordial}

Hemos recibido y analizado su cotización para la compra de 800 ton de urea destinada a la campaña soja 2026/27 de Cooperativa Coopagro. Apreciamos sinceramente su interés y la calidad de la propuesta presentada.

Considerando el volumen de la operación y la relación comercial sostenida con su empresa, quisiéramos solicitarles ${improvements.join(", ")}. Esta revisión nos permitiría avanzar con la adjudicación dentro de los plazos de la ventana fenológica V2-V4.

Quedamos atentos a su respuesta antes del cierre de evaluación.

Cordialmente,
Juan Perez — Cooperativa Coopagro
jperez@coopagro.coop.py`,
        };
      },
    ),

  weatherRisk: (department = "Itapua", horizon_days = 10) =>
    tryFetch<{ risk: number; description: string }>(
      `/api/v1/procurement/weather/risk?department=${department}&horizon_days=${horizon_days}`,
      undefined,
      () => ({ risk: 0.42, description: "Lluvias moderadas pronosticadas días 8-12 en Itapúa." }),
    ),

  fxUsdPyg: () =>
    tryFetch<{ rate: number; ts: string }>(
      `/api/v1/procurement/fx/usd_pyg`,
      undefined,
      () => ({ rate: 7350, ts: new Date().toISOString() }),
    ),

  listSuppliers: async () => {
    const raw = await tryFetch<any[]>(
      `/api/v1/procurement/suppliers?tenant_id=${TENANT_ID}`,
      undefined,
      () => SUPPLIERS as any[],
    );
    return raw.map(normalizeSupplier);
  },

  chatMessage: (
    message: string,
    opts: { request_id?: string } = {},
  ) =>
    tryFetch<ChatMessageResponse>(
      `/api/v1/procurement/chat/message`,
      {
        method: "POST",
        body: JSON.stringify({
          message,
          tenant_id: TENANT_ID,
          team_id: TEAM_ID,
          request_id: opts.request_id,
        }),
      },
      async () => mockChatReply(message, opts.request_id),
      60000,
    ),
};

function mockChatReply(message: string, requestId?: string): ChatMessageResponse {
  const lower = message.toLowerCase();
  const actions: ChatActionLink[] = requestId
    ? [
        { label: "Abrir solicitud", href: `/solicitud/${requestId}` },
        { label: "Comparar y recomendar", href: `/comparar/${requestId}` },
      ]
    : [];
  if (/(comparar|comparison|compara)/.test(lower)) {
    return {
      intent: "compare_request",
      reply:
        "_(modo offline)_ Mostraría la tabla normalizada de cotizaciones cuando el backend esté disponible.",
      data: {},
      actions,
    };
  }
  if (/(recomienda|recomendar|sugerir|recommend|adjudicar)/.test(lower)) {
    return {
      intent: "recommend_request",
      reply:
        "_(modo offline)_ La recomendación final se calcula con el orquestador de procurement (scoring + LLM).",
      data: {},
      actions,
    };
  }
  if (/(clima|tiempo|weather|lluvia)/.test(lower)) {
    return {
      intent: "weather_forecast",
      reply: "_(modo offline)_ Riesgo climático estimado en 42/100 para Itapúa, próximos 10 días.",
      data: {},
      actions: [],
    };
  }
  if (/(dolar|dólar|usd|pyg|cambio|fx)/.test(lower)) {
    return {
      intent: "fx_rate",
      reply: "_(modo offline)_ USD/PYG referencia ≈ 7.350 Gs.",
      data: {},
      actions: [],
    };
  }
  return {
    intent: "help",
    reply:
      "Puedo comparar cotizaciones, recomendar proveedor, extraer cotizaciones, mostrar clima y tipo de cambio.",
    data: {},
    actions: [],
  };
}

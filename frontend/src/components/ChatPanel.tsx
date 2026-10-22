import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Bot, Send, Sparkles, User2 } from "lucide-react";
import { api } from "@/lib/api";
import type { ChatActionLink, ChatIntent, ChatMessageResponse } from "@/lib/types";

type ChatTurn =
  | {
      kind: "user";
      id: string;
      content: string;
    }
  | {
      kind: "assistant";
      id: string;
      intent: ChatIntent;
      content: string;
      actions: ChatActionLink[];
      escalationReason?: string | null;
      pending?: boolean;
    };

const SUGGESTIONS = [
  "compara las cotizaciones",
  "recomienda el mejor proveedor",
  "clima en Itapua para 10 dias",
  "cotizacion del dolar",
  "solicitudes activas",
  "proveedores",
];

const INTENT_LABEL: Record<ChatIntent, string> = {
  compare_request: "Comparación",
  recommend_request: "Recomendación",
  extract_quotation: "Extracción de cotización",
  weather_forecast: "Pronóstico climático",
  fx_rate: "Tipo de cambio",
  list_requests: "Solicitudes",
  list_suppliers: "Proveedores",
  help: "Ayuda",
  unknown: "Sin coincidencia",
};

function genId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function renderInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, idx) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={idx} className="font-semibold text-foreground">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={idx} className="rounded bg-muted px-1 py-0.5 text-[0.8em] font-mono">
          {part.slice(1, -1)}
        </code>
      );
    }
    return <span key={idx}>{part}</span>;
  });
}

function MessageBody({ content }: { content: string }) {
  const blocks: Array<{ kind: "table"; rows: string[][] } | { kind: "text"; text: string }> = [];
  const lines = content.split("\n");
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trimStart().startsWith("|")) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trimStart().startsWith("|")) {
        tableLines.push(lines[i]);
        i += 1;
      }
      const rows = tableLines
        .map((row) =>
          row
            .trim()
            .replace(/^\|/, "")
            .replace(/\|$/, "")
            .split("|")
            .map((cell) => cell.trim()),
        )
        .filter((row, idx) => !(idx === 1 && row.every((cell) => /^[-:\s]+$/.test(cell))));
      blocks.push({ kind: "table", rows });
      continue;
    }
    blocks.push({ kind: "text", text: line });
    i += 1;
  }

  return (
    <div className="space-y-1.5 text-sm leading-relaxed">
      {blocks.map((block, idx) => {
        if (block.kind === "table") {
          const [head, ...body] = block.rows;
          return (
            <div key={idx} className="my-2 overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-left text-xs">
                {head ? (
                  <thead className="bg-muted/60 text-muted-foreground">
                    <tr>
                      {head.map((cell, c) => (
                        <th key={c} className="px-3 py-2 font-semibold">
                          {renderInline(cell)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                ) : null}
                <tbody>
                  {body.map((row, r) => (
                    <tr key={r} className="border-t border-border/60">
                      {row.map((cell, c) => (
                        <td key={c} className="px-3 py-1.5">
                          {renderInline(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        const text = block.text;
        if (!text.trim()) {
          return <div key={idx} className="h-1" />;
        }
        if (text.startsWith("### ")) {
          return (
            <h3 key={idx} className="text-sm font-semibold text-foreground">
              {renderInline(text.slice(4))}
            </h3>
          );
        }
        if (text.startsWith("## ")) {
          return (
            <h2 key={idx} className="text-base font-bold text-foreground">
              {renderInline(text.slice(3))}
            </h2>
          );
        }
        if (text.startsWith("- ") || text.startsWith("* ")) {
          return (
            <div key={idx} className="flex gap-2 pl-1">
              <span className="text-primary">•</span>
              <span>{renderInline(text.slice(2))}</span>
            </div>
          );
        }
        return <p key={idx}>{renderInline(text)}</p>;
      })}
    </div>
  );
}

export function ChatPanel({ requestIdHint }: { requestIdHint?: string }) {
  const [turns, setTurns] = useState<ChatTurn[]>(() => [
    {
      kind: "assistant",
      id: genId(),
      intent: "help",
      content:
        "Hola, soy el copiloto de compras de AgroBuy. Puedo correr el pipeline de ML para comparar cotizaciones, recomendar el mejor proveedor, extraer cotizaciones, mostrarte el clima y el tipo de cambio. ¿Por dónde empezamos?",
      actions: [],
    },
  ]);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const mutation = useMutation({
    mutationFn: ({ message, requestId }: { message: string; requestId?: string }) =>
      api.chatMessage(message, { request_id: requestId }),
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns.length, mutation.isPending]);

  const send = (raw: string) => {
    const text = raw.trim();
    if (!text || mutation.isPending) return;
    const userTurn: ChatTurn = { kind: "user", id: genId(), content: text };
    setTurns((prev) => [...prev, userTurn]);
    setInput("");
    mutation.mutate(
      { message: text, requestId: requestIdHint },
      {
        onSuccess: (response: ChatMessageResponse) => {
          setTurns((prev) => [
            ...prev,
            {
              kind: "assistant",
              id: genId(),
              intent: response.intent,
              content: response.reply,
              actions: response.actions ?? [],
              escalationReason: response.escalation_reason,
            },
          ]);
        },
        onError: (error: unknown) => {
          setTurns((prev) => [
            ...prev,
            {
              kind: "assistant",
              id: genId(),
              intent: "unknown",
              content:
                "No pude contactar al backend. Verificá que el servicio esté corriendo en el puerto 8000.",
              actions: [],
              escalationReason: error instanceof Error ? error.message : "network_error",
            },
          ]);
        },
      },
    );
  };

  return (
    <div className="card-soft flex h-[calc(100vh-12rem)] min-h-[520px] flex-col overflow-hidden">
      <header className="flex items-center justify-between border-b border-border bg-gradient-to-br from-primary-soft to-transparent px-5 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/30">
            <Sparkles className="h-4 w-4" aria-hidden />
          </div>
          <div>
            <h2 className="text-sm font-bold text-foreground">Copiloto de compras</h2>
            <p className="text-xs text-muted-foreground">
              Dispará el pipeline ML con lenguaje natural.
            </p>
          </div>
        </div>
        {requestIdHint ? (
          <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary ring-1 ring-primary/20">
            contexto: {requestIdHint}
          </span>
        ) : null}
      </header>

      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
        {turns.map((turn) => (
          <ChatBubble key={turn.id} turn={turn} />
        ))}
        {mutation.isPending ? (
          <ChatBubble
            turn={{
              kind: "assistant",
              id: "pending",
              intent: "help",
              content: "Pensando...",
              actions: [],
              pending: true,
            }}
          />
        ) : null}
      </div>

      <div className="border-t border-border bg-muted/30 px-5 py-3">
        <div className="mb-2 flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => send(s)}
              disabled={mutation.isPending}
              className="rounded-full border border-border bg-background px-3 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
            >
              {s}
            </button>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="flex items-end gap-2"
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            rows={2}
            placeholder="Pedime una comparación, recomendación, pronóstico o pegá una cotización..."
            aria-label="Mensaje para el copiloto"
            className="flex-1 resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <button
            type="submit"
            disabled={mutation.isPending || !input.trim()}
            className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Send className="h-4 w-4" aria-hidden /> Enviar
          </button>
        </form>
      </div>
    </div>
  );
}

function ChatBubble({ turn }: { turn: ChatTurn }) {
  if (turn.kind === "user") {
    return (
      <div className="flex items-start justify-end gap-2">
        <div className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm text-primary-foreground shadow-sm">
          {turn.content}
        </div>
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-primary ring-1 ring-primary/25">
          <User2 className="h-4 w-4" aria-hidden />
        </div>
      </div>
    );
  }
  const isPending = turn.pending === true;
  return (
    <div className="flex items-start gap-2">
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-earth/15 text-earth ring-1 ring-earth/25">
        <Bot className="h-4 w-4" aria-hidden />
      </div>
      <div className="max-w-[85%] flex-1">
        <div className="mb-1 flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground">
          <span className="font-semibold">Copiloto</span>
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground/80">
            {INTENT_LABEL[turn.intent] ?? turn.intent}
          </span>
          {turn.escalationReason ? (
            <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-medium text-destructive">
              {turn.escalationReason}
            </span>
          ) : null}
        </div>
        <div
          className={`rounded-2xl rounded-bl-md border border-border bg-card px-4 py-3 shadow-sm ${
            isPending ? "animate-pulse" : ""
          }`}
        >
          <MessageBody content={turn.content} />
          {turn.actions.length ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {turn.actions.map((action) => (
                <a
                  key={action.href}
                  href={action.href}
                  className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary ring-1 ring-primary/20 hover:bg-primary/20"
                >
                  {action.label}
                </a>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/PageShell";
import { ChatPanel } from "@/components/ChatPanel";

type ChatSearch = { request_id?: string };

export const Route = createFileRoute("/chat")({
  validateSearch: (search: Record<string, unknown>): ChatSearch => ({
    request_id: typeof search.request_id === "string" ? search.request_id : undefined,
  }),
  component: ChatPage,
  head: () => ({
    meta: [
      { title: "Copiloto de compras — AgroBuy" },
      {
        name: "description",
        content:
          "Chat conectado al pipeline de ML de procurement: comparación, recomendación, extracción y señales externas.",
      },
    ],
  }),
});

function ChatPage() {
  const { request_id } = Route.useSearch();
  return (
    <PageShell
      title="Copiloto de compras"
      subtitle={
        request_id
          ? `Conversación ligada a ${request_id}`
          : "Hablá con el copiloto y dejá que el motor de ML haga el trabajo"
      }
    >
      <ChatPanel requestIdHint={request_id} />
    </PageShell>
  );
}

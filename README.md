# AgroBuy

AI procurement copilot for Paraguayan agricultural cooperatives. **First place at the AI Tinkerers
San Lorenzo x FIUNA Deep Dive 2026 hackathon.**

A cooperative buyer registers a purchase request with its agronomic context, uploads supplier
quotations as text, compares them normalized to the day's exchange rate, gets a recommended
supplier with a score that shows its breakdown, and drafts the negotiation message.

## How a recommendation is made

- **Four LLM agents:** extractor, comparator, recommender and negotiator
  ([`procurement/agents/`](backend/agropredict/procurement/agents)), called in sequence by a plain
  Python orchestrator ([`orchestrator.py`](backend/agropredict/procurement/orchestrator.py)); its
  docstring explains why it skipped LangGraph. Each agent has a deterministic fallback, so the
  pipeline still answers with the LLM switched off, which is the Docker Compose default.
- **Supplier reliability model.** A `GradientBoostingClassifier` predicts on-time delivery. It
  scores AUC 0.748 on a stratified 20% held-out split of a **synthetic** delivery history
  ([`ml/train.py`](backend/agropredict/procurement/ml/train.py)): the demo has no real supplier
  records, so the history is generated per supplier profile. The number shows the pipeline works
  end to end; it says nothing about real suppliers. It was measured on the event day: the history
  is dated from the current date, so a rerun on another day lands slightly off it.
- **Price anomaly check.** Each quoted unit price, in USD, is placed against the market band the
  catalog stores for its category; the further outside the band, the higher the score
  ([`ml/anomaly_detector.py`](backend/agropredict/procurement/ml/anomaly_detector.py)).
- **Dual score.** Urgency = 0.45 weather risk + 0.40 delivery urgency + 0.15 market volatility.
  Offer = 0.35 supplier reliability + 0.40 commercial terms + 0.25 (100 − delivery risk)
  ([`scoring/`](backend/agropredict/procurement/scoring)). Every recommendation returns the
  breakdown, so a buyer can disagree with it.
- **Live signals.** Climate risk per Paraguayan department from Open-Meteo and the USD/PYG rate
  from open.er-api.com, both cached and with a fallback
  ([`external/`](backend/agropredict/procurement/external)).
- **API first.** FastAPI under `/api/v1/procurement`. The React app in `frontend/` consumes it; for
  Oracle APEX, the event's other client, the repo holds the build guide in
  [`docs/development/apex/`](docs/development/apex).

## Repository

| Path | What it is |
|---|---|
| `backend/agropredict/procurement/` | The hackathon module: agents, ML, scoring, external signals, demo fixtures |
| `backend/agropredict/` (the rest) | AgroPredict AI, the multi-agent platform AgroBuy is built on |
| `backend/tests/` | Backend tests |
| `frontend/` | Buyer-facing app: React 19, Vite, TanStack Router and Query, Tailwind |
| `docs/` | Product plan, MVP vs full scope, APEX guide, frontend brief, pitch deck (mostly in Spanish) |
| `archive/` | Platform pieces the hackathon did not use: Helm, Kubernetes, specs, runbooks |

## Run it

```bash
cp .env.example .env              # dev secrets for compose; LLM stays off unless you add a key
docker compose up -d --build
docker compose run --rm seed      # demo data
```

The app is at http://localhost:8080 and the API docs at http://localhost:8000/docs.
`docker-compose.yml` documents the optional profiles (Oracle XE, ARQ worker) and a hybrid mode with
the app on the host.

The demo data is synthetic: a fictional cooperative (Cooperativa Coopagro) and eight fictional
suppliers (Proveedor Agro 1 to 8).

## Tests

```bash
uv run --project backend pytest backend/tests/integration/test_procurement_*.py backend/tests/test_api.py
```

67 tests, no database needed.

## Team and credits

Built by the AgroBuy team at the AI Tinkerers San Lorenzo x FIUNA Deep Dive 2026 hackathon:

- Franco Cazal: backend, AI orchestration (the LangGraph agents) and the ML and scoring layer
- Cristian Paniagua
- Cecilia Benítez Montiel
- Allen Lin
- Guillermo Alexander

AgroBuy runs on AgroPredict AI, the multi-agent platform by Cristian Paniagua; the procurement
module, the buyer-facing app and the APEX app guide were built on top of it for the event.

## License

MIT. See [LICENSE](LICENSE).

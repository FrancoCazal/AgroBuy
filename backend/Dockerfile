FROM python:3.12-slim

WORKDIR /app

# libpq is needed at runtime by psycopg's binary wheel.
RUN apt-get update \
    && apt-get install -y --no-install-recommends libpq5 \
    && rm -rf /var/lib/apt/lists/* \
    && pip install --no-cache-dir uv

COPY pyproject.toml .
COPY README.md .
COPY alembic.ini .
COPY alembic/ alembic/
COPY agropredict/ agropredict/

RUN uv pip install --system "uvicorn[standard]>=0.34" "psycopg[binary]>=3.2" .

EXPOSE 8000

CMD ["uvicorn", "agropredict.app:app", "--host", "0.0.0.0", "--port", "8000"]

# FastAPI Raw SQL — security-research 5/6 variant
FROM python:3.12-slim AS runtime
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
COPY pyproject.toml ./
RUN pip install --no-cache-dir . || pip install --no-cache-dir \
    "fastapi>=0.115.0" "uvicorn[standard]>=0.32.0" "asyncpg>=0.29.0" \
    "pydantic>=2.9.0" "bcrypt>=4.2.0" "pyjwt>=2.9.0" "datadog>=0.51.0"
COPY src ./src
ENV PYTHONPATH=/app/src
EXPOSE 5001
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "5001"]

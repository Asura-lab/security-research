# security-research — fastapi-raw variant

FastAPI + asyncpg (Raw SQL, vulnerable-by-design) + Pydantic v2. Port 5001.

## Ажиллуулах

```bash
cp .env.example .env
docker compose up --build
```

- Frontend: http://localhost:3000
- Backend:  http://localhost:5001
- Postgres: :5432

Seed:

```bash
python db/seed.py
```

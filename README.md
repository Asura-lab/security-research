# security-research — fastapi-orm variant

FastAPI + SQLAlchemy 2.0 async (ORM, parameterized) + Pydantic v2. Port 5002.

## Ажиллуулах

```bash
cp .env.example .env
docker compose up --build
```

- Frontend: http://localhost:3000
- Backend:  http://localhost:5002
- Postgres: :5432

Seed:

```bash
python db/seed.py
```

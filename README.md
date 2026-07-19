# security-research — fiber-raw variant

Fiber (Go) + Raw SQL via pgx (vulnerable-by-design). Port 4001.

## Ажиллуулах

```bash
cp .env.example .env
docker compose up --build
```

- Frontend: http://localhost:3000
- Backend:  http://localhost:4001
- Postgres: :5432

Seed:

```bash
python db/seed.py
```

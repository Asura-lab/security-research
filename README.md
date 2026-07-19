# security-research — fiber-orm variant

Fiber (Go) + GORM ORM (parameterized). Port 4002.

## Ажиллуулах

```bash
cp .env.example .env
docker compose up --build
```

- Frontend: http://localhost:3000
- Backend:  http://localhost:4002
- Postgres: :5432

Seed:

```bash
python db/seed.py
```

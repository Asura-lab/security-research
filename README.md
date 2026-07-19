# security-research — nestjs-raw variant

Энэ branch нь `nestjs-raw` хувилбарыг (NestJS + Raw SQL, vulnerable-by-design) л агуулна.

## Ажиллуулах

```bash
cp .env.example .env
docker compose up --build
```

Үйлчилгээ:

- Frontend: http://localhost:3000
- Backend:  http://localhost:3001
- Postgres: :5432

Seed өгөгдөл нэмэх:

```bash
python db/seed.py
```

Халдлагын скрипт (attacks/) нь main branch дээр үлдэнэ — тэндээс env `VARIANT_NESTJS_RAW_URL`-аар public URL-руу зааж ажиллуулна.

## Documentation

See master documentation in Obsidian Vault: `01-Projects/security-research/`.

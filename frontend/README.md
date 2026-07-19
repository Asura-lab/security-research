# frontend/

Next.js 15 App Router + React 19. `NEXT_PUBLIC_API_BASE`-ыг variant branch-т тохируулна.

## Хуудсууд

- `/` — home
- `/login`, `/register` — auth
- `/products` — SQLi туршилтын entry point (search)
- `/orders` — BOLA туршилтын endpoint (GET/PUT/DELETE)
- `/profile` — Overposting туршилтын endpoint

## Локал ажиллуулах

```bash
cd frontend
npm install
NEXT_PUBLIC_API_BASE=http://localhost:3001 npm run dev
```

Main branch дээр default `NEXT_PUBLIC_API_BASE=""` — backend-руу холбогдохгүй (дүрмийн
дагуу main-д frontend/backend/DB хоорондоо салгаатай).

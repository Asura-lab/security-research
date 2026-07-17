# security-research — кодын хавтас

Судалгааны төслийн код. Баримтжуулалт: `C:\Users\Acer\Documents\Obsidian Vault\01-Projects\security-research\README.md`

## Бүтэц (төлөвлөгөө)

```
security-research/
├── frontend/          # Next.js (TypeScript) — API_BASE солих замаар 3 бэкэндтэй холбогдоно
├── backends/
│   ├── nestjs/        # NestJS (Node.js/TS)
│   │   ├── raw-sql/
│   │   └── orm/
│   ├── fiber/        # Fiber (Go)
│   │   ├── raw-sql/
│   │   └── orm/
│   └── fastapi/      # FastAPI (Python)
│       ├── raw-sql/
│       └── orm/
├── db/               # PostgreSQL schema, seeds, migration
├── attacks/          # Автоматжуулсан халдлагын скрипт
├── monitoring/      # Datadog тохиргоо, dashboards
├── docker-compose.yml # Бүх үйлчилгээг нэг дороос ажиллуулах
└── README.md         # Энэ файл
```

## Хувилбарууд

| # | Backend | DB хандах арга |
| --- | --- | --- |
| 1 | NestJS | Raw SQL (сул талтай) |
| 2 | NestJS | ORM (Prisma/TypeORM) |
| 3 | Fiber | Raw SQL (сул талтай) |
| 4 | Fiber | ORM (GORM) |
| 5 | FastAPI | Raw SQL (сул талтай) |
| 6 | FastAPI | ORM (SQLAlchemy) |

## Халдлагууд

- SQL Injection (Union-based Data Extraction) — Search/Filter
- BOLA (Broken Object Level Authorization) — Orders GET/PUT, ID solih
- JSON Overposting (Mass Assignment) — Profile Update

## Ажиллуулах

(Төлөвлөгөөний дараагаар docker-compose-оор бүгдийг нэг дороос ажиллуулна)

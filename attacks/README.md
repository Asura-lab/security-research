# attacks/

Локал WSL2/Windows-ээс public URL-руу халдлага илгээх Python скриптүүд.

## Файлууд

| Файл | Үүрэг |
| --- | --- |
| `common.py` | Variant registry, VariantClient, JSONL writer, detection helpers |
| `healthcheck.py` | 6 backend / health шалгах |
| `pre_attack_report.py` | 15 baseline шалгалт → `pre_attack_report.md` |
| `reset_targets.py` | R3: DB-т write target-уудыг initial marker руу буцаах |
| `01_sqli.py` | SQLi 3 вектор × 18 read target × 6 variant × 2 impl |
| `02_bola.py` | BOLA GET + PUT + DELETE × 15 write target |
| `03_overposting.py` | JSON Overposting × 5 profile_targets |
| `aggregate.py` | JSONL → summary.json (Total, Δ) |
| `anova_analysis.py` | 2-way ANOVA (Raw/ORM × хэл, α total) |
| `run_all.py` | R7 N=30 давталт (warmup + rounds) |

## Ажиллуулах

Local Postgres + 6 backend Docker-оор ажилладаг үед:

```bash
cd attacks
pip install .
python healthcheck.py
python pre_attack_report.py         # ≥12/15 PASS
python run_all.py --rounds 30       # ~5-7 минут
python aggregate.py
python anova_analysis.py
```

Render/өөр provider-т deploy хийсэн үед variant URL-уудыг env-ээр override:

```bash
export VARIANT_NESTJS_RAW_URL=https://sr-nestjs-raw.onrender.com
export VARIANT_NESTJS_ORM_URL=https://sr-nestjs-orm.onrender.com
# ... 4 өөр variant мөн адил
python run_all.py
```

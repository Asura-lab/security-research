# monitoring/

## Файлууд

- `dashboard.json` — Datadog dashboard экспорт (halдлагын үеийн duration, CPU, RAM, event marker).
- `metrics_export.py` — Datadog API-аас 1 цагийн metrics-ыг CSV болгоно (реporting-т).

## Ашиглах

### Dashboard оруулах

Datadog UI → Dashboards → New Dashboard → "Import JSON" → `dashboard.json`.

### Metrics CSV татах

```bash
export DD_API_KEY=...
export DD_APP_KEY=...
export DD_SITE=datadoghq.com
pip install datadog-api-client
python monitoring/metrics_export.py
```

Үр дүн: `monitoring/metrics_export.csv` — халдлагын үеийн duration_p95, cpu_pct, rss_bytes + attack markers.

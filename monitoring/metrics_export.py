"""Datadog API-аас халдлагын үеийн metrics-ыг экспорт хийж CSV болгоно.

`DD_API_KEY`, `DD_APP_KEY`, `DD_SITE` env-үүд шаардлагатай.
Оролт: attack.start / attack.end event-үүд (attack + variant + implementation tag-тай).
Гаралт: monitoring/metrics_export.csv.
"""

from __future__ import annotations

import csv
import datetime as dt
import os
import sys
from pathlib import Path

try:
    from datadog_api_client import ApiClient, Configuration
    from datadog_api_client.v1.api.events_api import EventsApi
    from datadog_api_client.v1.api.metrics_api import MetricsApi
except ImportError:  # pragma: no cover
    print("pip install datadog-api-client", file=sys.stderr)
    sys.exit(1)

OUT = Path(__file__).parent / "metrics_export.csv"

METRICS = (
    ("p95:http.request.duration{variant:*} by {variant,implementation}", "duration_p95_ms"),
    ("avg:docker.cpu.usage{container_name:security-research-*} by {container_name}", "cpu_pct"),
    ("avg:docker.mem.rss{container_name:security-research-*} by {container_name}", "rss_bytes"),
)


def main() -> int:
    if not os.getenv("DD_API_KEY") or not os.getenv("DD_APP_KEY"):
        print("DD_API_KEY, DD_APP_KEY заавал.")
        return 1
    now = dt.datetime.now(tz=dt.timezone.utc)
    frm = int((now - dt.timedelta(hours=1)).timestamp())
    to = int(now.timestamp())

    cfg = Configuration()
    cfg.api_key["apiKeyAuth"] = os.environ["DD_API_KEY"]
    cfg.api_key["appKeyAuth"] = os.environ["DD_APP_KEY"]
    cfg.server_variables["site"] = os.getenv("DD_SITE", "datadoghq.com")

    rows: list[dict[str, object]] = []
    with ApiClient(cfg) as client:
        metrics_api = MetricsApi(client)
        for query, metric_name in METRICS:
            result = metrics_api.query_metrics(_from=frm, to=to, query=query)
            for series in result.get("series", []):
                for ts, val in series.get("pointlist", []):
                    rows.append({
                        "metric": metric_name,
                        "scope": series.get("scope", ""),
                        "timestamp": ts,
                        "value": val,
                    })

        events_api = EventsApi(client)
        events = events_api.list_events(start=frm, end=to, tags="attack:*")
        for event in events.get("events", []):
            rows.append({
                "metric": "attack_marker",
                "scope": ",".join(event.get("tags", [])),
                "timestamp": event.get("date_happened"),
                "value": event.get("title"),
            })

    with OUT.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["metric", "scope", "timestamp", "value"])
        writer.writeheader()
        writer.writerows(rows)
    print(f"CSV -> {OUT} ({len(rows)} row)")
    return 0


if __name__ == "__main__":
    sys.exit(main())

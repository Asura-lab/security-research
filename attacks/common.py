"""Attack script-үүдийн ерөнхий utility.

- Variant registry: 6 backend-ын URL, статик тохиргоо
- HTTP client, JWT authenticate
- Datadog marker event
- Detection helpers (label + marker + nonce triple)
- JSONL writer
"""

from __future__ import annotations

import json
import os
import time
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Iterable

import httpx

try:
    from datadog import DogStatsd
except ImportError:  # pragma: no cover
    DogStatsd = None  # type: ignore[assignment]

RESULTS_DIR = Path(__file__).parent / "results"
RESULTS_DIR.mkdir(exist_ok=True)

READ_MARKER = "you got right data"
WRITE_INITIAL = "you will change this data"


@dataclass(frozen=True)
class Variant:
    name: str
    base_url: str


def load_variants() -> list[Variant]:
    """6 backend-ийн base URL. Env-ээс override хийж болно.

    ENV нэр:
      VARIANT_<NAME>_URL — жишээ VARIANT_NESTJS_RAW_URL=https://... (Render-т deploy хийсэн үед).
    """
    defaults = [
        ("nestjs-raw",  "http://localhost:3001"),
        ("nestjs-orm",  "http://localhost:3002"),
        ("fiber-raw",   "http://localhost:4001"),
        ("fiber-orm",   "http://localhost:4002"),
        ("fastapi-raw", "http://localhost:5001"),
        ("fastapi-orm", "http://localhost:5002"),
    ]
    variants: list[Variant] = []
    for name, default_url in defaults:
        env_key = "VARIANT_" + name.upper().replace("-", "_") + "_URL"
        variants.append(Variant(name=name, base_url=os.getenv(env_key, default_url)))
    return variants


@dataclass(frozen=True)
class Credentials:
    username: str
    password: str


CREDS_ATTACKER = Credentials(username="attacker", password="password123")
CREDS_VICTIM = Credentials(username="victim", password="password123")
CREDS_ADMIN = Credentials(username="admin", password="password123")


class VariantClient:
    """httpx client per variant + JWT кэш."""

    def __init__(self, variant: Variant, timeout_s: float = 10.0) -> None:
        self.variant = variant
        self._client = httpx.Client(base_url=variant.base_url, timeout=timeout_s)
        self._tokens: dict[str, str] = {}

    def close(self) -> None:
        self._client.close()

    def health(self) -> httpx.Response:
        return self._client.get("/health")

    def login(self, creds: Credentials) -> str:
        cached = self._tokens.get(creds.username)
        if cached is not None:
            return cached
        response = self._client.post(
            "/api/auth/login", json={"username": creds.username, "password": creds.password}
        )
        response.raise_for_status()
        token = response.json()["access_token"]
        self._tokens[creds.username] = token
        return token

    def request(
        self,
        method: str,
        path: str,
        *,
        token: str | None = None,
        json_body: Any = None,
        params: Any = None,
    ) -> httpx.Response:
        headers = {"Authorization": f"Bearer {token}"} if token else None
        return self._client.request(method, path, json=json_body, params=params, headers=headers)

    def targets_status(self, admin_token: str, label: str | None = None) -> list[dict[str, Any]]:
        response = self.request(
            "GET", "/api/admin/targets/status", token=admin_token,
            params={"label": label} if label else None,
        )
        response.raise_for_status()
        return response.json()["targets"]


class Statsd:
    """Datadog marker events — halдлагын хугацааны CPU/RAM/duration-ыг тодорхойлно."""

    def __init__(self) -> None:
        host = os.getenv("DD_AGENT_HOST")
        port = int(os.getenv("DD_DOGSTATSD_PORT", "8125"))
        self._client = None
        if host and DogStatsd is not None:
            try:
                self._client = DogStatsd(host=host, port=port)
            except Exception:  # noqa: BLE001
                self._client = None

    def marker(self, phase: str, attack: str, variant: str, implementation: str) -> None:
        if self._client is None:
            return
        try:
            self._client.event(
                title=f"attack.{phase}",
                text=f"{attack} @ {variant} ({implementation})",
                tags=[f"attack:{attack}", f"variant:{variant}", f"implementation:{implementation}", f"phase:{phase}"],
            )
        except Exception:  # noqa: BLE001
            pass


# =========================================================================
# Detection helpers
# =========================================================================


def read_success(response_text: str, label: str, nonce: str) -> bool:
    """R1: label + marker + nonce гурав хамт илэрсэн үед амжилттай."""
    return (
        label in response_text
        and READ_MARKER in response_text
        and nonce in response_text
    )


def write_success_put(target_value: str, nonce: str) -> bool:
    return target_value == f"You are hacked | {nonce}"


def write_success_delete(target_value: str, nonce: str) -> bool:
    return target_value == f"DELETED by hacker | {nonce}"


# =========================================================================
# JSONL writer
# =========================================================================


@dataclass
class ResultWriter:
    path: Path
    lines: list[dict[str, Any]] = field(default_factory=list)

    def append(self, record: dict[str, Any]) -> None:
        record.setdefault("timestamp", int(time.time() * 1000))
        self.lines.append(record)

    def flush(self) -> None:
        with self.path.open("w", encoding="utf-8") as f:
            for line in self.lines:
                f.write(json.dumps(line, ensure_ascii=False) + "\n")


def make_run_id() -> str:
    return uuid.uuid4().hex[:12]


def iter_variants(variants: Iterable[Variant] | None = None) -> Iterable[Variant]:
    return list(variants) if variants is not None else load_variants()

"""Activity feed: append-only log of launches, backups, achievements, friend events."""
from __future__ import annotations

import time
from . import db


MAX_ITEMS = 500


def log(kind: str, title: str, subtitle: str = "", meta: dict | None = None) -> dict:
    entry = {
        "kind": kind,
        "title": title,
        "subtitle": subtitle,
        "ts": int(time.time()),
        "meta": meta or {},
    }

    def mutate(data):
        if not isinstance(data, list):
            data = []
        data.insert(0, entry)
        return data[:MAX_ITEMS]

    db.update("activity", mutate)
    return entry


def recent(limit: int = 20) -> list[dict]:
    items = db.load("activity", [])
    if not isinstance(items, list):
        return []
    return items[:limit]

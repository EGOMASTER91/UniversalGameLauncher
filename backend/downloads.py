"""Download queue: persistent queue with simulated progress, so the UI panel has real data to render."""
from __future__ import annotations

import time
import uuid

from . import db


# Realistic default speed for the simulated downloads, in bytes per second.
DEFAULT_SPEED_BPS = 18 * 1024 * 1024


def _all() -> list[dict]:
    items = db.load("downloads", [])
    return items if isinstance(items, list) else []


def _save(items: list[dict]) -> None:
    db.save("downloads", items)


def _now() -> int:
    return int(time.time())


def _advance(items: list[dict]) -> list[dict]:
    """Move time forward for any in-progress downloads, persisting completion."""
    now = _now()
    changed = False
    for d in items:
        if d.get("status") != "downloading":
            continue
        last = d.get("last_tick_ts") or d.get("started_ts") or now
        elapsed = max(0, now - last)
        speed = max(1, int(d.get("speed_bps") or DEFAULT_SPEED_BPS))
        delta = elapsed * speed
        downloaded = min(int(d.get("size_bytes", 0)), int(d.get("downloaded_bytes", 0)) + delta)
        d["downloaded_bytes"] = downloaded
        d["last_tick_ts"] = now
        if downloaded >= int(d.get("size_bytes", 0)) and int(d.get("size_bytes", 0)) > 0:
            d["status"] = "completed"
            d["completed_ts"] = now
            d["downloaded_bytes"] = int(d.get("size_bytes", 0))
        changed = True
    if changed:
        _save(items)
    return items


def list_all() -> list[dict]:
    return _advance(_all())


def queue_summary() -> dict:
    items = list_all()
    active = [d for d in items if d.get("status") == "downloading"]
    queued = [d for d in items if d.get("status") == "queued"]
    paused = [d for d in items if d.get("status") == "paused"]
    completed = [d for d in items if d.get("status") == "completed"]
    total_size = sum(int(d.get("size_bytes", 0)) for d in active + queued + paused)
    total_done = sum(int(d.get("downloaded_bytes", 0)) for d in active + queued + paused)
    pct = int(total_done * 100 / total_size) if total_size else 0
    speed_sum = sum(int(d.get("speed_bps", 0)) for d in active)
    return {
        "active": len(active),
        "queued": len(queued),
        "paused": len(paused),
        "completed": len(completed),
        "total": len(items),
        "overall_percent": pct,
        "current_speed_bps": speed_sum,
        "remaining_bytes": max(0, total_size - total_done),
    }


def add(game_id: str, name: str, size_bytes: int, launcher: str = "", cover_url: str = "", speed_bps: int | None = None) -> dict:
    items = _all()
    if any(d.get("game_id") == game_id and d.get("status") in ("queued", "downloading", "paused") for d in items):
        existing = next(d for d in items if d.get("game_id") == game_id and d.get("status") in ("queued", "downloading", "paused"))
        return existing
    has_active = any(d.get("status") == "downloading" for d in items)
    entry = {
        "id": str(uuid.uuid4()),
        "game_id": game_id,
        "name": name,
        "launcher": launcher,
        "cover_url": cover_url,
        "size_bytes": int(size_bytes),
        "downloaded_bytes": 0,
        "speed_bps": int(speed_bps or DEFAULT_SPEED_BPS),
        "status": "queued" if has_active else "downloading",
        "added_ts": _now(),
        "started_ts": None if has_active else _now(),
        "last_tick_ts": None if has_active else _now(),
        "completed_ts": None,
    }
    items.append(entry)
    _save(items)
    return entry


def _find_index(items: list[dict], download_id: str) -> int:
    for i, d in enumerate(items):
        if d.get("id") == download_id:
            return i
    return -1


def _promote_next_queued(items: list[dict]) -> None:
    if any(d.get("status") == "downloading" for d in items):
        return
    for d in items:
        if d.get("status") == "queued":
            d["status"] = "downloading"
            d["started_ts"] = d.get("started_ts") or _now()
            d["last_tick_ts"] = _now()
            break


def pause(download_id: str) -> bool:
    items = _advance(_all())
    idx = _find_index(items, download_id)
    if idx < 0 or items[idx].get("status") not in ("downloading", "queued"):
        return False
    items[idx]["status"] = "paused"
    _promote_next_queued(items)
    _save(items)
    return True


def resume(download_id: str) -> bool:
    items = _advance(_all())
    idx = _find_index(items, download_id)
    if idx < 0 or items[idx].get("status") != "paused":
        return False
    has_active = any(d.get("status") == "downloading" for d in items)
    items[idx]["status"] = "queued" if has_active else "downloading"
    if not has_active:
        items[idx]["started_ts"] = items[idx].get("started_ts") or _now()
        items[idx]["last_tick_ts"] = _now()
    _save(items)
    return True


def cancel(download_id: str) -> bool:
    items = _advance(_all())
    idx = _find_index(items, download_id)
    if idx < 0:
        return False
    items.pop(idx)
    _promote_next_queued(items)
    _save(items)
    return True


def clear_completed() -> int:
    items = _all()
    before = len(items)
    items = [d for d in items if d.get("status") != "completed"]
    _save(items)
    return before - len(items)

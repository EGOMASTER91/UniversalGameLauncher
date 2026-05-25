"""Tiny JSON-file persistence layer with per-key locks and atomic writes."""
from __future__ import annotations

import json
import threading
from pathlib import Path
from typing import Any

from .paths import DATA_DIR


_LOCKS: dict[str, threading.Lock] = {}
_LOCKS_GUARD = threading.Lock()


def _lock_for(name: str) -> threading.Lock:
    with _LOCKS_GUARD:
        lock = _LOCKS.get(name)
        if lock is None:
            lock = threading.Lock()
            _LOCKS[name] = lock
        return lock


def _path(name: str) -> Path:
    return DATA_DIR / f"{name}.json"


def load(name: str, default: Any = None) -> Any:
    p = _path(name)
    with _lock_for(name):
        if not p.exists():
            return default if default is not None else {}
        try:
            return json.loads(p.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            return default if default is not None else {}


def save(name: str, data: Any) -> None:
    p = _path(name)
    with _lock_for(name):
        tmp = p.with_suffix(".json.tmp")
        tmp.write_text(json.dumps(data, indent=2, ensure_ascii=False, default=str), encoding="utf-8")
        tmp.replace(p)


def update(name: str, mutator) -> Any:
    with _lock_for(name):
        p = _path(name)
        if p.exists():
            try:
                data = json.loads(p.read_text(encoding="utf-8"))
            except (json.JSONDecodeError, OSError):
                data = {}
        else:
            data = {}
        new_data = mutator(data)
        result = new_data if new_data is not None else data
        tmp = p.with_suffix(".json.tmp")
        tmp.write_text(json.dumps(result, indent=2, ensure_ascii=False, default=str), encoding="utf-8")
        tmp.replace(p)
        return result

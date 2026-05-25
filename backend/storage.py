"""Real disk-usage stats: queries the filesystem for the volume hosting installed games."""
from __future__ import annotations

import os
import shutil
from pathlib import Path

from . import db
from .paths import BACKUP_DIR, home
from .launchers.manager import manager


def _primary_root() -> Path:
    games = manager.games()
    for g in games:
        if g.install_dir:
            try:
                root = Path(g.install_dir).anchor or "/"
                return Path(root)
            except Exception:
                continue
    return home()


def _dir_size(path: Path, cap: int = 5_000_000) -> int:
    total, files = 0, 0
    try:
        for root, _dirs, file_list in os.walk(path):
            for f in file_list:
                try:
                    total += (Path(root) / f).stat().st_size
                except OSError:
                    pass
                files += 1
                if files > cap:
                    return total
    except OSError:
        pass
    return total


def summary() -> dict:
    root = _primary_root()
    try:
        du = shutil.disk_usage(root)
        total = du.total
        used = du.used
        free = du.free
    except OSError:
        total = used = free = 0

    games_bytes = sum(g.size_bytes for g in manager.games() if g.installed and g.size_bytes)
    backups_bytes = _dir_size(BACKUP_DIR)
    mods_bytes = _dir_size(home() / ".local/share/gamehub/mods") if (home() / ".local/share/gamehub/mods").exists() else 0

    accounted = games_bytes + backups_bytes + mods_bytes
    other = max(used - accounted, 0)

    return {
        "root": str(root),
        "total_bytes": total,
        "used_bytes": used,
        "free_bytes": free,
        "segments": {
            "games": games_bytes,
            "saves": backups_bytes,
            "mods": mods_bytes,
            "other": other,
        },
        "cloud_synced": bool(db.load("settings", {}).get("cloud_sync", True)),
    }

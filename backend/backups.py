"""Save backup service: zips configured save folders, stores them under data/backups, tracks health."""
from __future__ import annotations

import os
import time
import zipfile
from pathlib import Path

from . import db
from .paths import BACKUP_DIR, home, is_windows, is_macos


# Sensible defaults for common games. Users can override via the settings endpoint.
DEFAULT_SAVE_HINTS: dict[str, list[str]] = {
    "Cyberpunk 2077": [
        "~/Saved Games/CD Projekt Red/Cyberpunk 2077",
        "~/Documents/CD Projekt Red/Cyberpunk 2077",
    ],
    "The Witcher 3": ["~/Documents/The Witcher 3"],
    "Elden Ring": ["~/AppData/Roaming/EldenRing"],
    "Baldur's Gate 3": ["~/AppData/Local/Larian Studios/Baldur's Gate 3"],
    "Red Dead Redemption 2": ["~/Documents/Rockstar Games/Red Dead Redemption 2"],
    "Forza Horizon 5": ["~/AppData/Local/Microsoft/ForzaHorizon5"],
    "Hogwarts Legacy": ["~/AppData/Local/Hogwarts Legacy"],
    "Skyrim Special Edition": ["~/Documents/My Games/Skyrim Special Edition"],
    "Starfield": ["~/Documents/My Games/Starfield"],
    "Hades": ["~/Documents/Saved Games/Hades"],
    "Hollow Knight": ["~/AppData/LocalLow/Team Cherry/Hollow Knight"],
    "Diablo IV": ["~/Documents/Diablo IV"],
    "It Takes Two": ["~/AppData/Local/IronHorse/Saved"],
    "Marvel's Spider-Man 2": ["~/Documents/Insomniac Games/Marvel's Spider-Man 2"],
    "Sekiro: Shadows Die Twice": ["~/AppData/Roaming/Sekiro"],
    "Grand Theft Auto V": ["~/Documents/Rockstar Games/GTA V"],
}


def _expand(p: str) -> Path:
    return Path(os.path.expandvars(os.path.expanduser(p)))


def _config() -> dict:
    return db.load("backups_config", {"games": {}})


def _state() -> dict:
    return db.load("backups_state", {"history": [], "last_run_ts": 0})


def configured_paths(game_name: str) -> list[Path]:
    cfg = _config()
    custom = cfg.get("games", {}).get(game_name, {}).get("paths", [])
    hints = DEFAULT_SAVE_HINTS.get(game_name, [])
    return [_expand(p) for p in (custom + hints)]


def existing_save_paths(game_name: str) -> list[Path]:
    return [p for p in configured_paths(game_name) if p.exists()]


def set_paths_for(game_name: str, paths: list[str]) -> None:
    cfg = _config()
    cfg.setdefault("games", {}).setdefault(game_name, {})["paths"] = paths
    db.save("backups_config", cfg)


def has_known_save_location(game_name: str) -> bool:
    return bool(configured_paths(game_name))


def _zip_dir(src: Path, zf: zipfile.ZipFile, arc_root: str) -> int:
    files = 0
    for root, _dirs, file_list in os.walk(src):
        for fn in file_list:
            fp = Path(root) / fn
            try:
                arcname = f"{arc_root}/{fp.relative_to(src).as_posix()}"
                zf.write(fp, arcname)
                files += 1
            except (OSError, ValueError):
                continue
    return files


def backup_game(game_name: str) -> dict:
    paths = existing_save_paths(game_name)
    if not paths:
        return {"ok": False, "game": game_name, "reason": "no save location found"}

    ts = int(time.time())
    safe = "".join(c if (c.isalnum() or c in "-_") else "_" for c in game_name)[:80]
    out = BACKUP_DIR / f"{safe}-{ts}.zip"
    total_files = 0
    total_bytes = 0
    try:
        with zipfile.ZipFile(out, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as zf:
            for idx, p in enumerate(paths):
                if p.is_file():
                    arc = f"path{idx}/{p.name}"
                    zf.write(p, arc)
                    total_files += 1
                else:
                    total_files += _zip_dir(p, zf, f"path{idx}")
        total_bytes = out.stat().st_size
    except OSError as e:
        return {"ok": False, "game": game_name, "reason": str(e)}

    entry = {
        "game": game_name,
        "ts": ts,
        "file": out.name,
        "size_bytes": total_bytes,
        "file_count": total_files,
    }

    def mutate(state: dict) -> dict:
        history = state.get("history") or []
        history.insert(0, entry)
        state["history"] = history[:200]
        state["last_run_ts"] = ts
        return state

    db.update("backups_state", mutate)
    _rotate(game_name, keep=5)
    return {"ok": True, **entry}


def _rotate(game_name: str, keep: int) -> None:
    safe = "".join(c if (c.isalnum() or c in "-_") else "_" for c in game_name)[:80]
    matches = sorted(BACKUP_DIR.glob(f"{safe}-*.zip"), reverse=True)
    for old in matches[keep:]:
        try:
            old.unlink()
        except OSError:
            pass


def backup_all(game_names: list[str]) -> dict:
    results = []
    started = time.time()
    for name in game_names:
        if has_known_save_location(name):
            results.append(backup_game(name))
    return {
        "ran": len(results),
        "ok": sum(1 for r in results if r.get("ok")),
        "duration_ms": int((time.time() - started) * 1000),
        "results": results,
    }


def status(game_names: list[str]) -> dict:
    state = _state()
    history = state.get("history") or []
    last_backed: dict[str, dict] = {}
    for e in history:
        if e["game"] not in last_backed:
            last_backed[e["game"]] = e

    eligible = [n for n in game_names if has_known_save_location(n)]
    protected = [n for n in eligible if n in last_backed]
    pct = (len(protected) * 100 // len(eligible)) if eligible else 0

    cloud_size = sum(e.get("size_bytes", 0) for e in last_backed.values())
    last_run = state.get("last_run_ts") or 0

    return {
        "percent": pct,
        "eligible_count": len(eligible),
        "protected_count": len(protected),
        "total_game_count": len(game_names),
        "last_run_ts": last_run,
        "cloud_size_bytes": cloud_size,
        "history_count": len(history),
        "health": "good" if pct >= 70 else ("warn" if pct >= 30 else "bad"),
    }


def history(limit: int = 50) -> list[dict]:
    state = _state()
    return (state.get("history") or [])[:limit]

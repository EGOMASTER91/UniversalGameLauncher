"""Mods service: scans known mod folders per game and exposes enable/disable as filename toggles."""
from __future__ import annotations

import os
import time
from pathlib import Path

from . import db
from .paths import home


# Known mod folder roots per game. These are the canonical user-modifiable locations.
DEFAULT_MOD_HINTS: dict[str, list[str]] = {
    "Skyrim Special Edition": ["~/Documents/My Games/Skyrim Special Edition/Mods", "~/AppData/Local/Skyrim Special Edition/Mods"],
    "Fallout 4": ["~/Documents/My Games/Fallout4/Mods"],
    "Starfield": ["~/Documents/My Games/Starfield/Mods"],
    "The Witcher 3": ["~/Documents/The Witcher 3/Mods"],
    "Cyberpunk 2077": ["~/AppData/Local/CD Projekt Red/Cyberpunk 2077/Mods"],
    "Stardew Valley": ["~/AppData/Roaming/StardewValley/Mods"],
    "Minecraft": ["~/AppData/Roaming/.minecraft/mods"],
    "Baldur's Gate 3": ["~/AppData/Local/Larian Studios/Baldur's Gate 3/Mods"],
    "Hogwarts Legacy": ["~/Documents/My Games/Hogwarts Legacy/Mods"],
    "Mount & Blade II: Bannerlord": ["~/Documents/Mount and Blade II Bannerlord/Modules"],
    "Kerbal Space Program": ["~/Documents/KSP/GameData"],
    "Total War: Warhammer III": ["~/AppData/Roaming/The Creative Assembly/Warhammer3/mods"],
    "Civilization VI": ["~/Documents/My Games/Sid Meier's Civilization VI/Mods"],
}

DISABLED_SUFFIX = ".gamehub-disabled"


def _expand(p: str) -> Path:
    return Path(os.path.expandvars(os.path.expanduser(p)))


def _config() -> dict:
    return db.load("mods_config", {"games": {}})


def _save_config(cfg: dict) -> None:
    db.save("mods_config", cfg)


def configured_dirs(game_name: str) -> list[Path]:
    cfg = _config()
    custom = cfg.get("games", {}).get(game_name, {}).get("dirs", [])
    hints = DEFAULT_MOD_HINTS.get(game_name, [])
    return [_expand(p) for p in (custom + hints)]


def set_dirs_for(game_name: str, dirs: list[str]) -> None:
    cfg = _config()
    cfg.setdefault("games", {}).setdefault(game_name, {})["dirs"] = dirs
    _save_config(cfg)


def _existing_dirs(game_name: str) -> list[Path]:
    return [d for d in configured_dirs(game_name) if d.exists() and d.is_dir()]


def _entry_size(p: Path) -> int:
    try:
        if p.is_file():
            return p.stat().st_size
        if p.is_dir():
            total = 0
            for root, _dirs, files in os.walk(p):
                for fn in files:
                    fp = Path(root) / fn
                    try:
                        total += fp.stat().st_size
                    except OSError:
                        continue
            return total
    except OSError:
        return 0
    return 0


def _entry_mtime(p: Path) -> int:
    try:
        return int(p.stat().st_mtime)
    except OSError:
        return 0


def list_for_game(game_name: str) -> dict:
    dirs = _existing_dirs(game_name)
    mods: list[dict] = []
    for d in dirs:
        try:
            entries = sorted(d.iterdir(), key=lambda e: e.name.lower())
        except OSError:
            continue
        for e in entries:
            if e.name.startswith(".") or e.name == DISABLED_SUFFIX:
                continue
            disabled = e.name.endswith(DISABLED_SUFFIX)
            display = e.name[:-len(DISABLED_SUFFIX)] if disabled else e.name
            mods.append({
                "id": f"{d.as_posix()}::{display}",
                "name": display,
                "path": str(e),
                "root": str(d),
                "enabled": not disabled,
                "size_bytes": _entry_size(e),
                "modified_ts": _entry_mtime(e),
                "kind": "directory" if e.is_dir() else "file",
            })
    enabled_count = sum(1 for m in mods if m["enabled"])
    return {
        "game": game_name,
        "roots": [str(d) for d in configured_dirs(game_name)],
        "existing_roots": [str(d) for d in dirs],
        "mods": mods,
        "count": len(mods),
        "enabled_count": enabled_count,
        "disabled_count": len(mods) - enabled_count,
        "total_size_bytes": sum(m["size_bytes"] for m in mods),
    }


def summary(games: list[dict]) -> dict:
    per_game = []
    for g in games:
        info = list_for_game(g.get("name", ""))
        if info["count"] or info["existing_roots"]:
            per_game.append({
                "game_id": g.get("id"),
                "name": g.get("name"),
                "launcher": g.get("launcher"),
                "count": info["count"],
                "enabled_count": info["enabled_count"],
                "size_bytes": info["total_size_bytes"],
                "roots": info["existing_roots"],
            })
    per_game.sort(key=lambda r: -r["count"])
    return {
        "games": per_game,
        "total_mods": sum(r["count"] for r in per_game),
        "total_enabled": sum(r["enabled_count"] for r in per_game),
        "total_size_bytes": sum(r["size_bytes"] for r in per_game),
        "games_with_mods": len(per_game),
    }


def _resolve(game_name: str, mod_id: str) -> tuple[Path, str] | None:
    if "::" not in mod_id:
        return None
    root_str, display = mod_id.split("::", 1)
    root = Path(root_str)
    if root not in _existing_dirs(game_name):
        return None
    enabled = root / display
    disabled = root / f"{display}{DISABLED_SUFFIX}"
    if enabled.exists():
        return enabled, display
    if disabled.exists():
        return disabled, display
    return None


def set_enabled(game_name: str, mod_id: str, enabled: bool) -> dict:
    resolved = _resolve(game_name, mod_id)
    if not resolved:
        return {"ok": False, "reason": "mod not found"}
    path, display = resolved
    target_enabled = path.parent / display
    target_disabled = path.parent / f"{display}{DISABLED_SUFFIX}"
    try:
        if enabled and path.name.endswith(DISABLED_SUFFIX):
            path.rename(target_enabled)
        elif (not enabled) and not path.name.endswith(DISABLED_SUFFIX):
            path.rename(target_disabled)
        else:
            return {"ok": True, "already": True, "enabled": enabled}
    except OSError as e:
        return {"ok": False, "reason": str(e)}

    log = _config()
    history = log.setdefault("history", [])
    history.insert(0, {
        "game": game_name,
        "mod": display,
        "enabled": enabled,
        "ts": int(time.time()),
    })
    log["history"] = history[:200]
    _save_config(log)
    return {"ok": True, "enabled": enabled, "mod": display}

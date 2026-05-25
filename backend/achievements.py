"""Achievements service: synthesizes per-game playtime milestones and tracks user unlocks in JSON."""
from __future__ import annotations

import time

from . import db


# Playtime milestones used as a launcher-agnostic baseline. Real launcher achievement
# data can later be layered on top via _platform_unlocks().
MILESTONES: list[tuple[str, str, int, int, str]] = [
    ("first_run",   "First Steps",        0,    5,   "Launch the game for the first time."),
    ("one_hour",    "Getting Started",   60,   10,   "Reach 1 hour of playtime."),
    ("five_hours",  "Hooked",           300,   15,   "Reach 5 hours of playtime."),
    ("ten_hours",   "Dedicated",        600,   20,   "Reach 10 hours of playtime."),
    ("twenty_five","Marathon Runner",  1500,   25,   "Reach 25 hours of playtime."),
    ("fifty_hours","Veteran",          3000,   40,   "Reach 50 hours of playtime."),
    ("hundred",    "Centurion",        6000,   60,   "Reach 100 hours of playtime."),
]


def _custom() -> dict:
    return db.load("achievements_custom", {"games": {}})


def _save_custom(data: dict) -> None:
    db.save("achievements_custom", data)


def _for_game_internal(game: dict) -> list[dict]:
    minutes = int(game.get("playtime_minutes") or 0)
    last_played = int(game.get("last_played_ts") or 0)
    custom = _custom().get("games", {}).get(game.get("id"), {})
    extra_unlocks: dict[str, int] = custom.get("unlocked", {})
    locked_overrides: set[str] = set(custom.get("locked", []))

    result: list[dict] = []
    for key, name, threshold, points, desc in MILESTONES:
        unlocked_ts = 0
        if key in extra_unlocks:
            unlocked_ts = int(extra_unlocks[key])
        elif key not in locked_overrides and minutes >= threshold and (threshold > 0 or last_played):
            unlocked_ts = last_played or int(time.time())
        result.append({
            "id": key,
            "name": name,
            "description": desc,
            "points": points,
            "threshold_minutes": threshold,
            "unlocked": bool(unlocked_ts),
            "unlocked_ts": unlocked_ts or None,
        })

    for cid, meta in (custom.get("custom") or {}).items():
        result.append({
            "id": f"custom_{cid}",
            "name": meta.get("name") or cid,
            "description": meta.get("description") or "",
            "points": int(meta.get("points") or 10),
            "threshold_minutes": None,
            "unlocked": bool(meta.get("unlocked_ts")),
            "unlocked_ts": meta.get("unlocked_ts"),
        })
    return result


def for_game(game: dict) -> dict:
    items = _for_game_internal(game)
    unlocked = [a for a in items if a["unlocked"]]
    points = sum(a["points"] for a in unlocked)
    total_points = sum(a["points"] for a in items)
    return {
        "game_id": game.get("id"),
        "name": game.get("name"),
        "launcher": game.get("launcher"),
        "items": items,
        "unlocked_count": len(unlocked),
        "total_count": len(items),
        "points": points,
        "total_points": total_points,
        "completion_percent": int(len(unlocked) * 100 / len(items)) if items else 0,
    }


def summary(games: list[dict]) -> dict:
    per_game = [for_game(g) for g in games if g.get("playtime_minutes") or g.get("installed")]
    per_game.sort(key=lambda r: (-r["completion_percent"], -r["points"], (r["name"] or "").lower()))
    total_unlocked = sum(r["unlocked_count"] for r in per_game)
    total_possible = sum(r["total_count"] for r in per_game)
    total_points = sum(r["points"] for r in per_game)
    total_points_possible = sum(r["total_points"] for r in per_game)
    completed_games = sum(1 for r in per_game if r["completion_percent"] >= 100)
    return {
        "games": per_game,
        "total_unlocked": total_unlocked,
        "total_possible": total_possible,
        "total_points": total_points,
        "total_points_possible": total_points_possible,
        "completed_games": completed_games,
        "tracked_games": len(per_game),
        "overall_percent": int(total_unlocked * 100 / total_possible) if total_possible else 0,
    }


def unlock(game_id: str, achievement_id: str, name: str = "", description: str = "", points: int = 10) -> bool:
    data = _custom()
    games = data.setdefault("games", {})
    entry = games.setdefault(game_id, {})
    now_ts = int(time.time())
    if achievement_id.startswith("custom_"):
        cid = achievement_id[len("custom_"):]
        customs = entry.setdefault("custom", {})
        meta = customs.setdefault(cid, {"name": name or cid, "description": description, "points": points})
        meta["unlocked_ts"] = now_ts
    else:
        entry.setdefault("unlocked", {})[achievement_id] = now_ts
        locked = set(entry.get("locked", []))
        locked.discard(achievement_id)
        entry["locked"] = sorted(locked)
    _save_custom(data)
    return True


def lock(game_id: str, achievement_id: str) -> bool:
    data = _custom()
    entry = data.setdefault("games", {}).setdefault(game_id, {})
    entry.setdefault("unlocked", {}).pop(achievement_id, None)
    locked = set(entry.get("locked", []))
    locked.add(achievement_id)
    entry["locked"] = sorted(locked)
    _save_custom(data)
    return True

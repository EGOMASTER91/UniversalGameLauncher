"""Aggregate stats: totals, weekly playtime chart, last-week comparison."""
from __future__ import annotations

import time
from datetime import datetime, timedelta

from . import db
from .launchers.manager import manager


def _sessions() -> list[dict]:
    return db.load("sessions", []) or []


def record_session(game_id: str, game_name: str, launcher: str, duration_minutes: int) -> None:
    def mutate(data):
        if not isinstance(data, list):
            data = []
        data.append({
            "game_id": game_id,
            "game_name": game_name,
            "launcher": launcher,
            "started_ts": int(time.time()) - duration_minutes * 60,
            "ended_ts": int(time.time()),
            "minutes": int(duration_minutes),
        })
        return data
    db.update("sessions", mutate)


def total_playtime_minutes() -> int:
    games = manager.games()
    from_launchers = sum(g.playtime_minutes for g in games)
    from_local = sum(int(s.get("minutes", 0)) for s in _sessions())
    return from_launchers + from_local


def weekly_chart(reference_ts: int | None = None) -> dict:
    now = datetime.fromtimestamp(reference_ts or time.time())
    day_start = datetime(now.year, now.month, now.day)
    week_buckets: list[dict] = []

    sessions = _sessions()
    for offset in range(6, -1, -1):
        d = day_start - timedelta(days=offset)
        start = d.timestamp()
        end = (d + timedelta(days=1)).timestamp()
        mins = sum(
            int(s.get("minutes", 0))
            for s in sessions
            if start <= s.get("ended_ts", 0) < end
        )
        week_buckets.append({
            "day": d.strftime("%a")[0],
            "date": d.strftime("%Y-%m-%d"),
            "minutes": mins,
            "active": offset == 0,
        })

    prior_buckets = []
    for offset in range(13, 6, -1):
        d = day_start - timedelta(days=offset)
        start = d.timestamp()
        end = (d + timedelta(days=1)).timestamp()
        mins = sum(
            int(s.get("minutes", 0))
            for s in sessions
            if start <= s.get("ended_ts", 0) < end
        )
        prior_buckets.append(mins)

    week_total = sum(b["minutes"] for b in week_buckets)
    prior_total = sum(prior_buckets)
    delta = week_total - prior_total

    return {
        "days": week_buckets,
        "week_total_minutes": week_total,
        "prior_week_minutes": prior_total,
        "delta_minutes": delta,
    }


def summary() -> dict:
    games = manager.games()
    installed = [g for g in games if g.installed]
    favs = db.load("favorites", []) or []

    weekly = weekly_chart()
    total_minutes = total_playtime_minutes()

    return {
        "total_games": len(games),
        "installed": len(installed),
        "favorites": len(favs),
        "total_playtime_minutes": total_minutes,
        "weekly": weekly,
    }

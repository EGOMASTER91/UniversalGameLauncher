"""Game library service: merges launcher data with local favorites/last-played, handles launch."""
from __future__ import annotations

import subprocess
import time
from pathlib import Path

from . import db, activity
from .launchers.manager import manager
from .launchers.base import Game
from .paths import is_windows, is_macos


def favorites() -> set[str]:
    favs = db.load("favorites", [])
    return set(favs) if isinstance(favs, list) else set()


def set_favorite(game_id: str, value: bool) -> bool:
    def mutate(data):
        if not isinstance(data, list):
            data = []
        s = set(data)
        if value:
            s.add(game_id)
        else:
            s.discard(game_id)
        return sorted(s)

    db.update("favorites", mutate)
    return value


def _enrich(games: list[Game]) -> list[dict]:
    favs = favorites()
    sessions = db.load("sessions", []) or []
    local_last: dict[str, int] = {}
    local_minutes: dict[str, int] = {}
    for s in sessions:
        gid = s.get("game_id")
        if not gid:
            continue
        local_last[gid] = max(local_last.get(gid, 0), int(s.get("ended_ts", 0)))
        local_minutes[gid] = local_minutes.get(gid, 0) + int(s.get("minutes", 0))

    out = []
    for g in games:
        d = g.to_dict()
        d["favorite"] = g.id in favs
        d["last_played_ts"] = max(g.last_played_ts, local_last.get(g.id, 0))
        d["playtime_minutes"] = g.playtime_minutes + local_minutes.get(g.id, 0)
        out.append(d)
    return out


def all_games() -> list[dict]:
    return _enrich(manager.games())


def recent_games(limit: int = 10) -> list[dict]:
    enriched = all_games()
    enriched.sort(key=lambda g: g.get("last_played_ts", 0), reverse=True)
    played = [g for g in enriched if g.get("last_played_ts")]
    return (played or enriched)[:limit]


def featured_game() -> dict | None:
    recent = recent_games(1)
    if recent:
        return recent[0]
    games = all_games()
    return games[0] if games else None


def find(game_id: str) -> Game | None:
    for g in manager.games():
        if g.id == game_id:
            return g
    return None


def launch(game_id: str) -> dict:
    game = find(game_id)
    if game is None:
        return {"ok": False, "reason": "game not found"}
    launcher = manager.by_id(game.launcher)
    uri = launcher.launch_uri(game) if launcher else None

    method = "uri"
    ok = False
    err: str | None = None
    if uri:
        try:
            if is_windows():
                subprocess.Popen(["cmd", "/c", "start", "", uri], shell=False)
            elif is_macos():
                subprocess.Popen(["open", uri])
            else:
                subprocess.Popen(["xdg-open", uri])
            ok = True
        except (OSError, FileNotFoundError) as e:
            err = str(e)

    if not ok and game.install_dir:
        method = "install_dir"
        try:
            install = Path(game.install_dir)
            exe = next((e for e in install.glob("*.exe") if "uninstall" not in e.name.lower()), None) if install.exists() else None
            if exe and is_windows():
                subprocess.Popen([str(exe)], cwd=str(install))
                ok = True
        except OSError as e:
            err = str(e)

    activity.log(
        kind="launch" if ok else "launch_failed",
        title=f"Launched {game.name}" if ok else f"Could not launch {game.name}",
        subtitle=launcher.name if launcher else "",
        meta={"game_id": game.id, "uri": uri, "method": method, "error": err},
    )
    return {"ok": ok, "uri": uri, "method": method, "error": err}

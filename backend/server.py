"""HTTP server: serves the SPA static files and exposes /api/* endpoints. stdlib-only."""
from __future__ import annotations

import json
import re
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse, parse_qs

from . import db, backups, stats, storage, activity, games as games_svc
from . import downloads, achievements, mods
from .launchers.manager import manager
from .paths import ROOT


Handler = "GameHubHandler"
ROUTES: list[tuple[str, re.Pattern, str]] = []


def route(method: str, pattern: str):
    def wrap(fn):
        ROUTES.append((method.upper(), re.compile(f"^{pattern}$"), fn.__name__))
        setattr(_RouteRegistry, fn.__name__, staticmethod(fn))
        return fn
    return wrap


class _RouteRegistry:
    pass


def _read_body(handler: BaseHTTPRequestHandler) -> dict:
    length = int(handler.headers.get("Content-Length", 0) or 0)
    if length <= 0:
        return {}
    try:
        raw = handler.rfile.read(length).decode("utf-8")
        return json.loads(raw) if raw else {}
    except (json.JSONDecodeError, UnicodeDecodeError):
        return {}


def _send_json(handler: BaseHTTPRequestHandler, status_code: int, payload):
    body = json.dumps(payload, default=str, ensure_ascii=False).encode("utf-8")
    handler.send_response(status_code)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(body)))
    handler.send_header("Cache-Control", "no-store")
    handler.end_headers()
    handler.wfile.write(body)


# ---------- API HANDLERS ----------

@route("GET", "/api/health")
def health(_h, _params, _body):
    return 200, {"ok": True, "service": "gamehub", "version": "0.2.0"}


@route("GET", "/api/launchers")
def list_launchers(_h, _params, _body):
    return 200, {"launchers": manager.status_summary()}


@route("POST", "/api/launchers/refresh")
def refresh_launchers(_h, _params, _body):
    games = manager.games(refresh=True)
    return 200, {"refreshed": True, "game_count": len(games)}


@route("GET", "/api/games")
def list_games(_h, params, _body):
    items = games_svc.all_games()
    flt = (params.get("filter") or [None])[0]
    if flt == "installed":
        items = [g for g in items if g.get("installed")]
    elif flt == "favorites":
        items = [g for g in items if g.get("favorite")]
    elif flt == "recent":
        items.sort(key=lambda g: g.get("last_played_ts", 0), reverse=True)
        items = items[:20]
    launcher = (params.get("launcher") or [None])[0]
    if launcher:
        items = [g for g in items if g.get("launcher") == launcher]
    q = (params.get("q") or [None])[0]
    if q:
        ql = q.lower()
        items = [g for g in items if ql in g.get("name", "").lower()]
    sort = (params.get("sort") or ["last_played"])[0]
    if sort == "name":
        items.sort(key=lambda g: g.get("name", "").lower())
    elif sort == "playtime":
        items.sort(key=lambda g: g.get("playtime_minutes", 0), reverse=True)
    elif sort == "last_played":
        items.sort(key=lambda g: g.get("last_played_ts", 0), reverse=True)
    return 200, {"games": items, "count": len(items)}


@route("GET", "/api/games/recent")
def games_recent(_h, params, _body):
    limit = int((params.get("limit") or ["10"])[0])
    return 200, {"games": games_svc.recent_games(limit=limit)}


@route("GET", "/api/games/featured")
def games_featured(_h, _params, _body):
    return 200, {"game": games_svc.featured_game()}


@route("POST", r"/api/games/(?P<gid>[^/]+)/launch")
def games_launch(_h, params, _body):
    gid = params["_match"]["gid"]
    return 200, games_svc.launch(gid)


@route("POST", r"/api/games/(?P<gid>[^/]+)/favorite")
def games_favorite(_h, params, body):
    gid = params["_match"]["gid"]
    val = bool(body.get("favorite", True))
    games_svc.set_favorite(gid, val)
    return 200, {"ok": True, "game_id": gid, "favorite": val}


@route("GET", "/api/stats")
def stats_summary(_h, _params, _body):
    return 200, stats.summary()


@route("GET", "/api/storage")
def storage_summary(_h, _params, _body):
    return 200, storage.summary()


@route("GET", "/api/backups/status")
def backups_status(_h, _params, _body):
    names = [g.get("name") for g in games_svc.all_games()]
    return 200, backups.status(names)


@route("GET", "/api/backups")
def backups_list(_h, params, _body):
    limit = int((params.get("limit") or ["50"])[0])
    return 200, {"history": backups.history(limit=limit)}


@route("POST", "/api/backups/run")
def backups_run(_h, _params, body):
    game = body.get("game")
    if game:
        result = backups.backup_game(game)
        activity.log(
            kind="backup" if result.get("ok") else "backup_failed",
            title=("Backup completed " if result.get("ok") else "Backup failed for ") + game,
            subtitle=f"{result.get('file_count', 0)} files",
            meta=result,
        )
        return 200, result
    names = [g.get("name") for g in games_svc.all_games()]
    result = backups.backup_all(names)
    activity.log(
        kind="backup",
        title=f"Bulk backup ran for {result['ok']}/{result['ran']} games",
        subtitle=f"{result['duration_ms']} ms",
        meta={"ok": result["ok"], "ran": result["ran"]},
    )
    return 200, result


@route("GET", "/api/activity")
def activity_feed(_h, params, _body):
    limit = int((params.get("limit") or ["20"])[0])
    return 200, {"items": activity.recent(limit=limit)}


@route("POST", "/api/sessions")
def post_session(_h, _params, body):
    gid = body.get("game_id")
    minutes = int(body.get("minutes") or 0)
    name = body.get("name") or ""
    launcher = body.get("launcher") or ""
    if not gid or minutes <= 0:
        return 400, {"error": "game_id and positive minutes required"}
    stats.record_session(gid, name, launcher, minutes)
    return 200, {"ok": True}


@route("GET", "/api/settings")
def get_settings(_h, _params, _body):
    return 200, db.load("settings", {
        "cloud_sync": True,
        "auto_backup_minutes": 30,
        "theme": "dark",
    })


@route("POST", "/api/settings")
def update_settings(_h, _params, body):
    current = db.load("settings", {})
    current.update(body or {})
    db.save("settings", current)
    return 200, current


@route("GET", "/api/backups/config")
def get_backup_config(_h, _params, _body):
    return 200, db.load("backups_config", {"games": {}})


@route("POST", "/api/backups/config")
def set_backup_config(_h, _params, body):
    game = body.get("game")
    paths = body.get("paths") or []
    if not game:
        return 400, {"error": "game required"}
    backups.set_paths_for(game, paths)
    return 200, {"ok": True, "game": game, "paths": paths}


# ---------- DOWNLOADS ----------

@route("GET", "/api/downloads")
def list_downloads(_h, _params, _body):
    items = downloads.list_all()
    return 200, {"items": items, "summary": downloads.queue_summary()}


@route("POST", "/api/downloads")
def create_download(_h, _params, body):
    gid = body.get("game_id")
    if not gid:
        return 400, {"error": "game_id required"}
    game = next((g for g in games_svc.all_games() if g.get("id") == gid), None)
    if game is None:
        return 404, {"error": "game not found"}
    size = int(body.get("size_bytes") or game.get("size_bytes") or 0)
    if size <= 0:
        size = 12 * 1024 * 1024 * 1024  # default 12 GB for cloud-only games
    entry = downloads.add(
        game_id=gid,
        name=game.get("name") or gid,
        size_bytes=size,
        launcher=game.get("launcher") or "",
        cover_url=game.get("cover_url") or "",
        speed_bps=int(body.get("speed_bps") or 0) or None,
    )
    activity.log(
        kind="download",
        title=f"Download queued: {entry['name']}",
        subtitle=game.get("launcher") or "",
        meta={"download_id": entry["id"], "game_id": gid},
    )
    return 200, entry


@route("POST", r"/api/downloads/(?P<did>[^/]+)/pause")
def pause_download(_h, params, _body):
    return (200, {"ok": True}) if downloads.pause(params["_match"]["did"]) else (404, {"error": "not found"})


@route("POST", r"/api/downloads/(?P<did>[^/]+)/resume")
def resume_download(_h, params, _body):
    return (200, {"ok": True}) if downloads.resume(params["_match"]["did"]) else (404, {"error": "not found"})


@route("DELETE", r"/api/downloads/(?P<did>[^/]+)")
def cancel_download(_h, params, _body):
    return (200, {"ok": True}) if downloads.cancel(params["_match"]["did"]) else (404, {"error": "not found"})


@route("POST", "/api/downloads/clear")
def clear_downloads(_h, _params, _body):
    removed = downloads.clear_completed()
    return 200, {"removed": removed}


# ---------- ACHIEVEMENTS ----------

@route("GET", "/api/achievements")
def list_achievements(_h, _params, _body):
    return 200, achievements.summary(games_svc.all_games())


@route("GET", r"/api/achievements/(?P<gid>[^/]+)")
def game_achievements(_h, params, _body):
    gid = params["_match"]["gid"]
    game = next((g for g in games_svc.all_games() if g.get("id") == gid), None)
    if game is None:
        return 404, {"error": "game not found"}
    return 200, achievements.for_game(game)


@route("POST", r"/api/achievements/(?P<gid>[^/]+)/unlock")
def unlock_achievement(_h, params, body):
    gid = params["_match"]["gid"]
    aid = body.get("achievement_id")
    if not aid:
        return 400, {"error": "achievement_id required"}
    game = next((g for g in games_svc.all_games() if g.get("id") == gid), None)
    achievements.unlock(
        gid, aid,
        name=body.get("name") or "",
        description=body.get("description") or "",
        points=int(body.get("points") or 10),
    )
    if game:
        activity.log(
            kind="achievement",
            title=f"Achievement unlocked in {game.get('name')}",
            subtitle=body.get("name") or aid,
            meta={"game_id": gid, "achievement_id": aid},
        )
    return 200, {"ok": True}


@route("POST", r"/api/achievements/(?P<gid>[^/]+)/lock")
def lock_achievement(_h, params, body):
    gid = params["_match"]["gid"]
    aid = body.get("achievement_id")
    if not aid:
        return 400, {"error": "achievement_id required"}
    achievements.lock(gid, aid)
    return 200, {"ok": True}


# ---------- MODS ----------

@route("GET", "/api/mods")
def list_all_mods(_h, _params, _body):
    return 200, mods.summary(games_svc.all_games())


@route("GET", r"/api/mods/(?P<gid>[^/]+)")
def mods_for_game(_h, params, _body):
    gid = params["_match"]["gid"]
    game = next((g for g in games_svc.all_games() if g.get("id") == gid), None)
    if game is None:
        return 404, {"error": "game not found"}
    return 200, mods.list_for_game(game.get("name") or "")


@route("POST", r"/api/mods/(?P<gid>[^/]+)/toggle")
def toggle_mod(_h, params, body):
    gid = params["_match"]["gid"]
    mod_id = body.get("mod_id")
    enabled = bool(body.get("enabled"))
    if not mod_id:
        return 400, {"error": "mod_id required"}
    game = next((g for g in games_svc.all_games() if g.get("id") == gid), None)
    if game is None:
        return 404, {"error": "game not found"}
    result = mods.set_enabled(game.get("name") or "", mod_id, enabled)
    if result.get("ok"):
        activity.log(
            kind="mod",
            title=f"Mod {'enabled' if enabled else 'disabled'}: {result.get('mod')}",
            subtitle=game.get("name") or "",
            meta={"game_id": gid, "mod_id": mod_id, "enabled": enabled},
        )
    return (200 if result.get("ok") else 400), result


@route("POST", r"/api/mods/(?P<gid>[^/]+)/dirs")
def set_mod_dirs(_h, params, body):
    gid = params["_match"]["gid"]
    dirs = body.get("dirs") or []
    game = next((g for g in games_svc.all_games() if g.get("id") == gid), None)
    if game is None:
        return 404, {"error": "game not found"}
    mods.set_dirs_for(game.get("name") or "", dirs)
    return 200, {"ok": True, "dirs": dirs}


# ---------- NOTIFICATIONS ----------

@route("GET", "/api/notifications")
def notifications(_h, params, _body):
    since = int((params.get("since") or ["0"])[0])
    items = activity.recent(limit=50)
    unseen = [a for a in items if int(a.get("ts") or 0) > since]
    return 200, {"unseen": len(unseen), "items": unseen[:10], "latest_ts": items[0]["ts"] if items else 0}


# ---------- HTTP HANDLER ----------

class GameHubHandler(BaseHTTPRequestHandler):
    server_version = "GameHub/0.2"

    def log_message(self, fmt, *args):
        return

    def _dispatch(self, method: str):
        parsed = urlparse(self.path)
        params = parse_qs(parsed.query)
        body = _read_body(self) if method in ("POST", "PUT", "PATCH", "DELETE") else {}

        if parsed.path.startswith("/api/"):
            for m, rx, fn_name in ROUTES:
                if m != method:
                    continue
                match = rx.match(parsed.path)
                if match:
                    params["_match"] = match.groupdict()
                    try:
                        status_code, payload = getattr(_RouteRegistry, fn_name)(self, params, body)
                    except Exception as e:
                        _send_json(self, 500, {"error": "internal", "detail": str(e)})
                        return
                    _send_json(self, status_code, payload)
                    return
            _send_json(self, 404, {"error": "not found"})
            return

        self._serve_static(parsed.path)

    def _serve_static(self, path: str):
        if path == "/" or path == "":
            path = "/index.html"
        rel = path.lstrip("/")
        full = (ROOT / rel).resolve()
        try:
            full.relative_to(ROOT)
        except ValueError:
            self.send_error(403, "Forbidden")
            return
        if not full.exists() or not full.is_file():
            self.send_error(404, "Not Found")
            return
        ext = full.suffix.lower()
        mime = {
            ".html": "text/html; charset=utf-8",
            ".css": "text/css; charset=utf-8",
            ".js": "application/javascript; charset=utf-8",
            ".json": "application/json; charset=utf-8",
            ".svg": "image/svg+xml",
            ".png": "image/png",
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".webp": "image/webp",
            ".ico": "image/x-icon",
            ".woff2": "font/woff2",
        }.get(ext, "application/octet-stream")
        data = full.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", mime)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-cache" if ext in (".html", ".js", ".css") else "public, max-age=3600")
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):    self._dispatch("GET")
    def do_POST(self):   self._dispatch("POST")
    def do_PUT(self):    self._dispatch("PUT")
    def do_DELETE(self): self._dispatch("DELETE")

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()


def serve(host: str = "127.0.0.1", port: int = 8765) -> None:
    httpd = ThreadingHTTPServer((host, port), GameHubHandler)
    print(f"GameHub Launcher backend running at http://{host}:{port}")
    print(f"   Static UI:  http://{host}:{port}/")
    print(f"   API root:   http://{host}:{port}/api/")
    print("Press Ctrl+C to stop.")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down...")
        httpd.shutdown()

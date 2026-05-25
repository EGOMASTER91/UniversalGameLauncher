"""Steam launcher: parses libraryfolders.vdf and appmanifest_*.acf to enumerate installed games."""
from __future__ import annotations

from pathlib import Path

from . import vdf
from .base import Game, Launcher
from ..paths import steam_roots


def _read_library_folders(steam_root: Path) -> list[Path]:
    candidates = [
        steam_root / "steamapps/libraryfolders.vdf",
        steam_root / "config/libraryfolders.vdf",
    ]
    folders = [steam_root / "steamapps"]
    for c in candidates:
        if not c.exists():
            continue
        try:
            parsed = vdf.parse(c.read_text(encoding="utf-8", errors="ignore"))
        except Exception:
            continue
        root = parsed.get("libraryfolders") or parsed.get("LibraryFolders") or {}
        for key, val in root.items():
            if isinstance(val, dict):
                p = val.get("path") or val.get("Path") or val.get("contentid")
                if p:
                    folders.append(Path(p) / "steamapps")
            elif isinstance(val, str) and key.isdigit():
                folders.append(Path(val) / "steamapps")
        break
    return [f for f in folders if f.exists()]


def _parse_manifest(path: Path) -> dict | None:
    try:
        parsed = vdf.parse(path.read_text(encoding="utf-8", errors="ignore"))
    except Exception:
        return None
    return parsed.get("AppState") or parsed.get("appstate")


class SteamLauncher(Launcher):
    id = "steam"
    name = "Steam"

    def _root(self) -> Path | None:
        for r in steam_roots():
            if r.exists():
                return r
        return None

    def detected(self) -> bool:
        return self._root() is not None

    def games(self) -> list[Game]:
        root = self._root()
        if root is None:
            return []
        results: list[Game] = []
        seen: set[str] = set()
        for libdir in _read_library_folders(root):
            try:
                manifests = sorted(libdir.glob("appmanifest_*.acf"))
            except OSError:
                continue
            for m in manifests:
                state = _parse_manifest(m)
                if not state:
                    continue
                appid = str(state.get("appid") or state.get("AppID") or "")
                if not appid or appid in seen:
                    continue
                seen.add(appid)
                name = state.get("name") or state.get("Name") or f"App {appid}"
                installdir = state.get("installdir") or state.get("InstallDir")
                install_path = libdir / "common" / installdir if installdir else None
                installed = (install_path is not None and install_path.exists())
                size = int(state.get("SizeOnDisk", state.get("BytesDownloaded", 0)) or 0)
                last_played = int(state.get("LastPlayed", 0) or 0)
                results.append(Game(
                    id=f"steam:{appid}",
                    launcher=self.id,
                    native_id=appid,
                    name=name,
                    install_dir=str(install_path) if install_path else None,
                    installed=installed,
                    size_bytes=size,
                    cover_url=f"https://cdn.cloudflare.steamstatic.com/steam/apps/{appid}/library_600x900_2x.jpg",
                    last_played_ts=last_played,
                ))
        return results

    def launch_uri(self, game: Game) -> str | None:
        return f"steam://run/{game.native_id}"

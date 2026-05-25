"""Epic Games Launcher: parses .item manifest files written by the launcher to ProgramData."""
from __future__ import annotations

import json
from pathlib import Path

from .base import Game, Launcher
from ..paths import epic_manifest_dirs


class EpicLauncher(Launcher):
    id = "epic"
    name = "Epic Games"

    def _manifest_dir(self) -> Path | None:
        for d in epic_manifest_dirs():
            if d.exists():
                return d
        return None

    def detected(self) -> bool:
        return self._manifest_dir() is not None

    def games(self) -> list[Game]:
        d = self._manifest_dir()
        if d is None:
            return []
        results: list[Game] = []
        try:
            files = sorted(d.glob("*.item"))
        except OSError:
            return []
        for f in files:
            try:
                data = json.loads(f.read_text(encoding="utf-8", errors="ignore"))
            except (json.JSONDecodeError, OSError):
                continue
            app = data.get("AppName") or data.get("MainGameAppName") or data.get("CatalogItemId")
            if not app:
                continue
            display = data.get("DisplayName") or data.get("MandatoryAppFolderName") or app
            install_path = data.get("InstallLocation") or data.get("ManifestLocation")
            size = int(data.get("InstallSize") or 0)
            installed = bool(install_path and Path(install_path).exists())
            results.append(Game(
                id=f"epic:{app}",
                launcher=self.id,
                native_id=str(app),
                name=display,
                install_dir=install_path,
                installed=installed,
                size_bytes=size,
                cover_url=None,
            ))
        return results

    def launch_uri(self, game: Game) -> str | None:
        return f"com.epicgames.launcher://apps/{game.native_id}?action=launch&silent=true"

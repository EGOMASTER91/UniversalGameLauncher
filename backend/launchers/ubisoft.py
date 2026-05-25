"""Ubisoft Connect: scans the games directory the launcher writes to and reads on-disk configs."""
from __future__ import annotations

from pathlib import Path

from .base import Game, Launcher
from ..paths import ubisoft_roots


class UbisoftLauncher(Launcher):
    id = "ubisoft"
    name = "Ubisoft Connect"

    def _root(self) -> Path | None:
        for r in ubisoft_roots():
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
        games_dir = root / "games"
        if not games_dir.exists():
            return []
        try:
            for entry in sorted(games_dir.iterdir()):
                if entry.is_dir():
                    name = entry.name.replace("_", " ").title()
                    size = sum(p.stat().st_size for p in entry.rglob("*") if p.is_file())
                    results.append(Game(
                        id=f"ubisoft:{entry.name}",
                        launcher=self.id,
                        native_id=entry.name,
                        name=name,
                        install_dir=str(entry),
                        installed=True,
                        size_bytes=size,
                    ))
        except OSError:
            pass
        return results

    def launch_uri(self, game: Game) -> str | None:
        return f"uplay://launch/{game.native_id}/0"

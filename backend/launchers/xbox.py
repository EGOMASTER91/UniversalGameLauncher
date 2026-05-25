"""Xbox / Microsoft Store: enumerates the XboxGames folder where Game Pass titles install by default."""
from __future__ import annotations

from pathlib import Path

from .base import Game, Launcher
from ..paths import xbox_roots


class XboxLauncher(Launcher):
    id = "xbox"
    name = "Xbox App"

    def _root(self) -> Path | None:
        for r in xbox_roots():
            if r.exists():
                return r
        return None

    def detected(self) -> bool:
        return self._root() is not None

    def games(self) -> list[Game]:
        if not self.detected():
            return []
        results: list[Game] = []
        root = Path("C:/XboxGames")
        if root.exists():
            try:
                for entry in sorted(root.iterdir()):
                    if entry.is_dir():
                        try:
                            size = sum(p.stat().st_size for p in entry.rglob("*") if p.is_file())
                        except OSError:
                            size = 0
                        results.append(Game(
                            id=f"xbox:{entry.name}",
                            launcher=self.id,
                            native_id=entry.name,
                            name=entry.name,
                            install_dir=str(entry),
                            installed=True,
                            size_bytes=size,
                        ))
            except OSError:
                pass
        return results

    def launch_uri(self, game: Game) -> str | None:
        return f"shell:AppsFolder\\{game.native_id}"

"""EA App / Origin: detects via install root and reads the local content manifest cache."""
from __future__ import annotations

from pathlib import Path

from .base import Game, Launcher
from ..paths import ea_roots, env_path


class EALauncher(Launcher):
    id = "ea"
    name = "EA App"

    def _root(self) -> Path | None:
        for r in ea_roots():
            if r.exists():
                return r
        return None

    def detected(self) -> bool:
        return self._root() is not None

    def games(self) -> list[Game]:
        if not self.detected():
            return []
        results: list[Game] = []
        local = env_path("LOCALAPPDATA")
        manifest_dir = local / "Electronic Arts/EA Desktop/LocalContent" if local else None
        if manifest_dir and manifest_dir.exists():
            try:
                for entry in sorted(manifest_dir.iterdir()):
                    if entry.is_dir():
                        results.append(Game(
                            id=f"ea:{entry.name}",
                            launcher=self.id,
                            native_id=entry.name,
                            name=entry.name.replace("_", " ").title(),
                            install_dir=str(entry),
                            installed=True,
                        ))
            except OSError:
                pass
        return results

    def launch_uri(self, game: Game) -> str | None:
        return f"origin2://library/open?offerIds={game.native_id}"

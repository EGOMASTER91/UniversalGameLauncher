"""Battle.net: detects the client and reads product DB to enumerate Blizzard titles."""
from __future__ import annotations

import json
from pathlib import Path

from .base import Game, Launcher
from ..paths import battlenet_roots, env_path


KNOWN = {
    "wow": "World of Warcraft",
    "wow_classic": "World of Warcraft Classic",
    "d3": "Diablo III",
    "d4": "Diablo IV",
    "d2r": "Diablo II Resurrected",
    "ov": "Overwatch 2",
    "pro": "Overwatch 2",
    "hs": "Hearthstone",
    "hero": "Heroes of the Storm",
    "s2": "StarCraft II",
    "s1": "StarCraft Remastered",
}


class BattleNetLauncher(Launcher):
    id = "bnet"
    name = "Battle.net"

    def _root(self) -> Path | None:
        for r in battlenet_roots():
            if r.exists():
                return r
        return None

    def detected(self) -> bool:
        return self._root() is not None

    def games(self) -> list[Game]:
        if not self.detected():
            return []
        results: list[Game] = []
        pd = env_path("ProgramData") or Path("C:/ProgramData")
        db_file = pd / "Battle.net/Agent/product.db"
        if db_file.exists():
            try:
                raw = db_file.read_bytes()
                for key, display in KNOWN.items():
                    if key.encode() in raw:
                        results.append(Game(
                            id=f"bnet:{key}",
                            launcher=self.id,
                            native_id=key,
                            name=display,
                            installed=True,
                        ))
            except OSError:
                pass
        return results

    def launch_uri(self, game: Game) -> str | None:
        return f"battlenet://{game.native_id}"

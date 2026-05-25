"""Riot Client: detects the client and enumerates known products from the install root."""
from __future__ import annotations

from pathlib import Path

from .base import Game, Launcher
from ..paths import riot_roots


PRODUCTS = {
    "League of Legends": "league_of_legends",
    "VALORANT": "valorant",
    "Legends of Runeterra": "bacon",
    "Riot Client": None,
}


class RiotLauncher(Launcher):
    id = "riot"
    name = "Riot Client"

    def _root(self) -> Path | None:
        for r in riot_roots():
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
        for display, slug in PRODUCTS.items():
            if slug is None:
                continue
            p = root / display
            if p.exists():
                results.append(Game(
                    id=f"riot:{slug}",
                    launcher=self.id,
                    native_id=slug,
                    name=display,
                    install_dir=str(p),
                    installed=True,
                ))
        return results

    def launch_uri(self, game: Game) -> str | None:
        return f"riotclient://rc/launch-product?productId={game.native_id}"

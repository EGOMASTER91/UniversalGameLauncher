"""Aggregates all launcher integrations and caches their results."""
from __future__ import annotations

import threading
import time
from typing import Iterable

from .base import Game, Launcher
from .steam import SteamLauncher
from .epic import EpicLauncher
from .gog import GOGLauncher
from .ubisoft import UbisoftLauncher
from .ea import EALauncher
from .battlenet import BattleNetLauncher
from .xbox import XboxLauncher
from .riot import RiotLauncher


_ORDER: list[type[Launcher]] = [
    SteamLauncher, EpicLauncher, GOGLauncher, UbisoftLauncher,
    EALauncher, BattleNetLauncher, XboxLauncher, RiotLauncher,
]


class LauncherManager:
    def __init__(self, ttl_seconds: int = 30):
        self._launchers: list[Launcher] = [cls() for cls in _ORDER]
        self._cache_games: list[Game] | None = None
        self._cache_at: float = 0.0
        self._ttl = ttl_seconds
        self._lock = threading.Lock()

    @property
    def launchers(self) -> list[Launcher]:
        return self._launchers

    def by_id(self, lid: str) -> Launcher | None:
        for l in self._launchers:
            if l.id == lid:
                return l
        return None

    def games(self, refresh: bool = False) -> list[Game]:
        with self._lock:
            now = time.time()
            if not refresh and self._cache_games is not None and (now - self._cache_at) < self._ttl:
                return list(self._cache_games)
            collected: list[Game] = []
            for l in self._launchers:
                try:
                    if l.detected():
                        collected.extend(l.games())
                except Exception:
                    continue
            self._cache_games = collected
            self._cache_at = now
            return list(collected)

    def status_summary(self) -> list[dict]:
        games = self.games()
        counts: dict[str, int] = {}
        for g in games:
            counts[g.launcher] = counts.get(g.launcher, 0) + 1
        out: list[dict] = []
        for l in self._launchers:
            out.append({
                "id": l.id,
                "name": l.name,
                "detected": bool(l.detected()),
                "game_count": counts.get(l.id, 0),
            })
        return out


manager = LauncherManager()

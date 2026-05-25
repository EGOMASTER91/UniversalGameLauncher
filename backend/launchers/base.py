"""Launcher abstract interface and the canonical Game record returned to the frontend."""
from __future__ import annotations

from dataclasses import dataclass, field, asdict
from typing import Optional


@dataclass
class Game:
    id: str
    launcher: str
    native_id: str
    name: str
    install_dir: Optional[str] = None
    installed: bool = False
    size_bytes: int = 0
    cover_url: Optional[str] = None
    last_played_ts: int = 0
    playtime_minutes: int = 0
    tags: list[str] = field(default_factory=list)
    favorite: bool = False

    def to_dict(self) -> dict:
        return asdict(self)


class Launcher:
    """Concrete launchers subclass this. Every method is best-effort and must never raise."""
    id: str = ""
    name: str = ""

    def detected(self) -> bool:
        return False

    def games(self) -> list[Game]:
        return []

    def launch_uri(self, game: Game) -> str | None:
        return None

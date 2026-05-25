"""GOG Galaxy: reads the SQLite database galaxy-2.0.db that the launcher maintains."""
from __future__ import annotations

import json
import sqlite3
from pathlib import Path

from .base import Game, Launcher
from ..paths import gog_database_paths


class GOGLauncher(Launcher):
    id = "gog"
    name = "GOG Galaxy"

    def _db(self) -> Path | None:
        for p in gog_database_paths():
            if p.exists() and p.is_file():
                return p
        return None

    def detected(self) -> bool:
        return self._db() is not None

    def games(self) -> list[Game]:
        db = self._db()
        if db is None:
            return []
        results: list[Game] = []
        try:
            con = sqlite3.connect(f"file:{db}?mode=ro", uri=True, timeout=2)
            con.row_factory = sqlite3.Row
            cur = con.cursor()
            cur.execute("""
                SELECT lr.releaseKey AS rk, gpd.title AS title, ib.installationPath AS path
                FROM LimitedReleases lr
                LEFT JOIN GamePieces gpd ON gpd.releaseKey = lr.releaseKey AND gpd.gamePieceTypeId IN (
                    SELECT id FROM GamePieceTypes WHERE type = 'title'
                )
                LEFT JOIN InstalledBaseProducts ib ON ib.productId = REPLACE(lr.releaseKey, 'gog_', '')
                WHERE lr.releaseKey LIKE 'gog_%'
                LIMIT 1000
            """)
            for row in cur.fetchall():
                rk = row["rk"] or ""
                native_id = rk.replace("gog_", "")
                title_raw = row["title"]
                title = "Unknown"
                if title_raw:
                    try:
                        title = json.loads(title_raw).get("title", title_raw)
                    except (json.JSONDecodeError, AttributeError):
                        title = str(title_raw)
                path = row["path"]
                results.append(Game(
                    id=f"gog:{native_id}",
                    launcher=self.id,
                    native_id=native_id,
                    name=title,
                    install_dir=path,
                    installed=bool(path and Path(path).exists()),
                ))
            con.close()
        except (sqlite3.Error, OSError):
            return []
        return results

    def launch_uri(self, game: Game) -> str | None:
        return f"goggalaxy://openGameView/{game.native_id}"

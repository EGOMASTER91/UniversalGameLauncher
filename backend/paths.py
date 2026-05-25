"""Resolve cross-platform filesystem locations for GameHub and the launchers it integrates with."""
from __future__ import annotations

import os
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
BACKUP_DIR = DATA_DIR / "backups"

DATA_DIR.mkdir(parents=True, exist_ok=True)
BACKUP_DIR.mkdir(parents=True, exist_ok=True)


def home() -> Path:
    return Path.home()


def is_windows() -> bool:
    return sys.platform.startswith("win")


def is_macos() -> bool:
    return sys.platform == "darwin"


def is_linux() -> bool:
    return sys.platform.startswith("linux")


def env_path(name: str) -> Path | None:
    v = os.environ.get(name)
    return Path(v) if v else None


def candidate_dirs(*paths: Path | None) -> list[Path]:
    return [p for p in paths if p is not None]


# Steam install root candidates
def steam_roots() -> list[Path]:
    if is_windows():
        roots = [
            env_path("ProgramFiles(x86)") and env_path("ProgramFiles(x86)") / "Steam",
            env_path("ProgramFiles") and env_path("ProgramFiles") / "Steam",
            Path("C:/Program Files (x86)/Steam"),
            Path("C:/Program Files/Steam"),
        ]
    elif is_macos():
        roots = [home() / "Library/Application Support/Steam"]
    else:
        roots = [
            home() / ".steam/steam",
            home() / ".local/share/Steam",
            home() / ".var/app/com.valvesoftware.Steam/data/Steam",
        ]
    return candidate_dirs(*roots)


# Epic Games manifest dir candidates
def epic_manifest_dirs() -> list[Path]:
    if is_windows():
        pd = env_path("ProgramData") or Path("C:/ProgramData")
        return [pd / "Epic/EpicGamesLauncher/Data/Manifests"]
    if is_macos():
        return [home() / "Library/Application Support/Epic/EpicGamesLauncher/Data/Manifests"]
    # Linux via Heroic / Wine prefix - best effort
    return [
        home() / ".config/legendary",
        home() / ".config/heroic",
    ]


# GOG Galaxy
def gog_database_paths() -> list[Path]:
    if is_windows():
        pd = env_path("ProgramData") or Path("C:/ProgramData")
        return [pd / "GOG.com/Galaxy/storage/galaxy-2.0.db"]
    return [home() / ".config/heroic/gog_store"]


# Ubisoft Connect
def ubisoft_roots() -> list[Path]:
    if is_windows():
        pf = env_path("ProgramFiles(x86)") or Path("C:/Program Files (x86)")
        return [pf / "Ubisoft/Ubisoft Game Launcher"]
    return []


# EA App
def ea_roots() -> list[Path]:
    if is_windows():
        pf = env_path("ProgramFiles") or Path("C:/Program Files")
        return [
            pf / "Electronic Arts/EA Desktop",
            Path("C:/Program Files (x86)/Origin"),
        ]
    return []


# Battle.net
def battlenet_roots() -> list[Path]:
    if is_windows():
        pf = env_path("ProgramFiles(x86)") or Path("C:/Program Files (x86)")
        return [pf / "Battle.net"]
    return []


# Xbox / Microsoft Store
def xbox_roots() -> list[Path]:
    if is_windows():
        return [Path("C:/XboxGames"), Path("C:/Program Files/WindowsApps")]
    return []


# Riot Client
def riot_roots() -> list[Path]:
    if is_windows():
        return [Path("C:/Riot Games")]
    if is_macos():
        return [Path("/Applications/Riot Client.app")]
    return []

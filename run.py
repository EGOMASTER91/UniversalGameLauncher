#!/usr/bin/env python3
"""Entry point: starts the GameHub Launcher backend + serves the UI on localhost."""
from __future__ import annotations

import argparse
import sys
import threading
import webbrowser

from backend.server import serve


def main() -> int:
    ap = argparse.ArgumentParser(description="GameHub Launcher")
    ap.add_argument("--host", default="127.0.0.1")
    ap.add_argument("--port", type=int, default=8765)
    ap.add_argument("--no-browser", action="store_true", help="do not auto-open the UI in the browser")
    args = ap.parse_args()

    if not args.no_browser:
        url = f"http://{args.host}:{args.port}/"
        threading.Timer(0.6, lambda: webbrowser.open(url)).start()

    try:
        serve(args.host, args.port)
    except OSError as e:
        print(f"Failed to bind {args.host}:{args.port}: {e}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

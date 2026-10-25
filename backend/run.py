#!/usr/bin/env python
"""Start the CLIPY.ID backend.

Usage:
    python run.py                # http://127.0.0.1:8000
    python run.py --port 8080 --reload
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

# Allow `python run.py` from anywhere.
sys.path.insert(0, str(Path(__file__).resolve().parent))


def main() -> int:
    parser = argparse.ArgumentParser(description="CLIPY.ID v0.1 server")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--reload", action="store_true", help="auto-reload saat file berubah")
    args = parser.parse_args()

    try:
        import uvicorn
    except ImportError:
        print(
            "uvicorn belum terpasang.\n"
            "Jalankan: pip install -r requirements.txt",
            file=sys.stderr,
        )
        return 1

    from app.config import TOOLING

    if not TOOLING.ok:
        print(
            "PERINGATAN: ffmpeg/ffprobe tidak ditemukan di PATH.\n"
            "CLIPY.ID membutuhkan ffmpeg untuk memproses video.\n"
            "Windows: winget install Gyan.FFmpeg\n",
            file=sys.stderr,
        )

    print(f"\n  CLIPY.ID v0.1  ->  http://{args.host}:{args.port}")
    print(f"  Dokumentasi  ->  http://{args.host}:{args.port}/docs\n")

    uvicorn.run(
        "app.main:app",
        host=args.host,
        port=args.port,
        reload=args.reload,
        log_level="info",
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

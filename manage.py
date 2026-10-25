"""Cross-platform setup and launcher for CLIPY.ID. Uses only Python's standard library."""
from __future__ import annotations

import argparse
import os
from pathlib import Path
import shutil
import subprocess
import sys
import venv

ROOT = Path(__file__).resolve().parent
BACKEND = ROOT / 'backend'
ENV = BACKEND / '.venv'
PYTHON = ENV / ('Scripts/python.exe' if os.name == 'nt' else 'bin/python')


def run(args: list[str], cwd: Path = ROOT) -> None:
    subprocess.run(args, cwd=cwd, check=True)


def check() -> bool:
    ready = True
    for tool in ('node', 'npm', 'ffmpeg', 'ffprobe'):
        found = shutil.which(tool)
        print(f"{'OK' if found else 'MISSING'}  {tool}")
        ready = ready and bool(found)
    if not ready:
        print('Install Node.js LTS and FFmpeg first. See README.md for Windows/macOS instructions.')
    return ready


def main() -> int:
    parser = argparse.ArgumentParser(description='CLIPY.ID v0.1 - local video clipping studio')
    parser.add_argument('command', choices=('setup', 'run', 'check'))
    parser.add_argument('--port', type=int, default=8000)
    args = parser.parse_args()
    if not (3, 10) <= sys.version_info[:2] < (3, 14):
        print('Please use Python 3.10-3.13. Python 3.12 is recommended.')
        return 1
    if args.command == 'check':
        return 0 if check() else 1
    if args.command == 'setup':
        if not check():
            return 1
        if not PYTHON.exists():
            venv.EnvBuilder(with_pip=True).create(ENV)
        run([str(PYTHON), '-m', 'pip', 'install', '-r', 'requirements.txt'], BACKEND)
        npm = shutil.which('npm')
        assert npm is not None
        run([npm, 'ci'], ROOT / 'frontend')
        run([npm, 'run', 'build'], ROOT / 'frontend')
        print('\nCLIPY.ID is ready. Run: python manage.py run')
        return 0
    if not PYTHON.exists() or not (ROOT / 'frontend/dist/index.html').exists():
        print('Run python manage.py setup first.')
        return 1
    if not 1 <= args.port <= 65535:
        parser.error('--port must be between 1 and 65535')
    print(f'Open http://127.0.0.1:{args.port} in your browser. Keep this window open; Ctrl+C stops the server.', flush=True)
    run([str(PYTHON), 'run.py', '--port', str(args.port)], BACKEND)
    return 0


if __name__ == '__main__':
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        print('\nCLIPY.ID stopped.')
    except (subprocess.CalledProcessError, OSError) as exc:
        print(f'Setup/run failed: {exc}', file=sys.stderr)
        raise SystemExit(1)

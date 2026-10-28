#!/usr/bin/env python3
"""Download the exercise GIFs this app needs into public/media/exercises/.

The repository does not ship the media: 1,324 animations add ~130 MB and the
artwork belongs to Gym visual. This script pulls them from the upstream
open dataset once, then rewrites public/data/exercises.json to the local
/media/ paths so the app works offline and without a CDN.

Usage:
    python3 scripts/fetch-media.py [--root /path/to/project]
"""
from __future__ import annotations

import argparse
import json
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

DATASET_URL = 'https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main/data/exercises.json'
MEDIA_BASE = 'https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main/'
WORKERS = 8
TIMEOUT = 40


def download(url: str, target: Path) -> int:
    for attempt in range(3):
        try:
            request = urllib.request.Request(url, headers={'User-Agent': 'FitdayMediaFetcher/1.0'})
            with urllib.request.urlopen(request, timeout=TIMEOUT) as response:
                payload = response.read()
            if len(payload) < 1024:
                raise ValueError(f'payload too small ({len(payload)} bytes)')
            target.write_bytes(payload)
            return len(payload)
        except Exception as error:  # noqa: BLE001 - retry any transport failure
            if attempt == 2:
                raise
            time.sleep(1 + attempt)
    raise RuntimeError('unreachable')


def main() -> int:
    parser = argparse.ArgumentParser(description='Fetch exercise GIFs into public/media/exercises')
    parser.add_argument('root', nargs='?', default=Path(__file__).resolve().parent.parent, type=Path)
    args = parser.parse_args()

    root = args.root.resolve()
    data_path = root / 'public' / 'data' / 'exercises.json'
    media_dir = root / 'public' / 'media' / 'exercises'
    if not data_path.exists():
        print(f'missing data file: {data_path}', file=sys.stderr)
        return 1

    items = json.loads(data_path.read_text(encoding='utf-8'))
    media_dir.mkdir(parents=True, exist_ok=True)

    missing = [item for item in items if not (media_dir / f"{item['id']}.gif").exists()]
    print(f'{len(items)} exercises, {len(items) - len(missing)} already cached, {len(missing)} to fetch')
    if missing:
        print('loading upstream index...')
        with urllib.request.urlopen(DATASET_URL, timeout=60) as response:
            upstream = json.loads(response.read().decode('utf-8'))
        index = {str(row['id']): row.get('gif_url') or row.get('gifUrl') for row in upstream}

        def fetch(item: dict) -> tuple[str, str]:
            source = index.get(str(item['id']))
            if not source:
                return item['id'], 'no-source'
            url = source if source.startswith('http') else f'{MEDIA_BASE}{source}'
            try:
                download(url, media_dir / f"{item['id']}.gif")
                return item['id'], 'ok'
            except Exception as error:  # noqa: BLE001 - report and continue
                return item['id'], f'fail: {error}'

        done = 0
        failed: list[tuple[str, str]] = []
        with ThreadPoolExecutor(max_workers=WORKERS) as pool:
            futures = [pool.submit(fetch, item) for item in missing]
            for future in as_completed(futures):
                exercise_id, status = future.result()
                done += 1
                if status != 'ok':
                    failed.append((exercise_id, status))
                if done % 50 == 0 or done == len(missing):
                    print(f'  {done}/{len(missing)}')
        for exercise_id, status in failed[:20]:
            print(f'  {exercise_id}: {status}', file=sys.stderr)
        if failed:
            print(f'{len(failed)} files failed; re-run to retry', file=sys.stderr)

    changed = 0
    for item in items:
        target = media_dir / f"{item['id']}.gif"
        local = f"/media/exercises/{item['id']}.gif"
        if target.exists() and target.stat().st_size > 1024 and item.get('gifUrl') != local:
            item['gifUrl'] = local
            changed += 1
    if changed:
        data_path.write_text(json.dumps(items, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')

    total = sum(1 for item in items if (media_dir / f"{item['id']}.gif").exists())
    size_mb = sum(p.stat().st_size for p in media_dir.glob('*.gif')) / 1024 / 1024
    print(f'media ready: {total}/{len(items)} files, {size_mb:.1f} MB, data paths updated: {changed}')
    return 0 if total == len(items) else 2


if __name__ == '__main__':
    raise SystemExit(main())

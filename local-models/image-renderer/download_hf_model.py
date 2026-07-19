from __future__ import annotations

import argparse
import fnmatch
import os
import sys
import time
from pathlib import Path

import requests
from huggingface_hub import HfApi, hf_hub_url


DEFAULT_ALLOW = [
    "model_index.json",
    "scheduler/*",
    "tokenizer/*",
    "text_encoder/*",
    "unet/*",
    "vae/*",
]


def allowed(name: str, patterns: list[str]) -> bool:
    return any(fnmatch.fnmatch(name, pattern) for pattern in patterns)


def download_file(repo: str, filename: str, target: Path, token: str | None, timeout: int, chunk_size: int) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"

    existing = target.stat().st_size if target.exists() else 0
    if existing:
        headers["Range"] = f"bytes={existing}-"

    url = hf_hub_url(repo, filename)
    started = time.time()
    last_print = started
    mode = "ab" if existing else "wb"
    with requests.get(url, headers=headers, stream=True, timeout=timeout, allow_redirects=True) as response:
        if response.status_code == 416:
            print(f"already complete {filename}")
            return
        response.raise_for_status()
        if existing and response.status_code != 206:
            existing = 0
            mode = "wb"

        expected = response.headers.get("content-length")
        expected_size = existing + int(expected) if expected and expected.isdigit() else None
        written = existing
        with target.open(mode + "") as handle:
            for chunk in response.iter_content(chunk_size=chunk_size):
                if not chunk:
                    continue
                handle.write(chunk)
                written += len(chunk)
                now = time.time()
                if now - last_print >= 10:
                    mb = written / 1024 / 1024
                    total = f" / {expected_size / 1024 / 1024:.1f} MB" if expected_size else ""
                    print(f"{filename}: {mb:.1f} MB{total}", flush=True)
                    last_print = now
    print(f"downloaded {filename}: {target.stat().st_size / 1024 / 1024:.1f} MB")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo", required=True)
    parser.add_argument("--target", required=True)
    parser.add_argument("--allow", action="append", default=[])
    parser.add_argument("--timeout", type=int, default=180)
    parser.add_argument("--chunk-size", type=int, default=1024 * 1024)
    args = parser.parse_args()

    token = os.environ.get("HF_TOKEN") or os.environ.get("HUGGINGFACE_HUB_TOKEN")
    patterns = args.allow or DEFAULT_ALLOW
    target = Path(args.target)
    api = HfApi(token=token)
    info = api.model_info(args.repo, files_metadata=True)
    files = [s for s in info.siblings if allowed(s.rfilename, patterns)]
    if not files:
        raise RuntimeError(f"No files matched allow patterns for {args.repo}: {patterns}")

    total = sum(s.size or 0 for s in files)
    print(f"Downloading {len(files)} files from {args.repo} ({total / 1024 / 1024 / 1024:.2f} GB) to {target}")
    for sibling in files:
        destination = target / sibling.rfilename
        if sibling.size and destination.exists() and destination.stat().st_size == sibling.size:
            print(f"skip complete {sibling.rfilename}")
            continue
        for attempt in range(1, 6):
            try:
                download_file(args.repo, sibling.rfilename, destination, token, args.timeout, args.chunk_size)
                break
            except Exception as exc:
                print(f"attempt {attempt} failed for {sibling.rfilename}: {exc}", file=sys.stderr, flush=True)
                if attempt == 5:
                    raise
                time.sleep(5 * attempt)
    print("model download complete")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

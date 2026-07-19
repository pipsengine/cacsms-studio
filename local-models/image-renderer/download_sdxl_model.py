from __future__ import annotations

import os
from pathlib import Path


def main() -> int:
    target_dir = Path(__file__).resolve().parent / "models" / "realvisxl-v4"
    target_dir.mkdir(parents=True, exist_ok=True)
    target_file = target_dir / "RealVisXL_V4.0.safetensors"

    if target_file.exists() and target_file.stat().st_size > 1_000_000_000:
        print(str(target_file))
        return 0

    try:
        from huggingface_hub import hf_hub_download
    except ImportError as exc:
        raise SystemExit(
            "huggingface_hub is required. Install with: python -m pip install huggingface_hub"
        ) from exc

    repo_id = os.environ.get("CACSMS_SDXL_MODEL_REPO", "SG161222/RealVisXL_V4.0")
    filename = os.environ.get("CACSMS_SDXL_MODEL_FILENAME", "RealVisXL_V4.0.safetensors")
    print(f"Downloading {repo_id}/{filename} to {target_dir} ...", flush=True)
    downloaded = hf_hub_download(
        repo_id=repo_id,
        filename=filename,
        local_dir=str(target_dir),
        local_dir_use_symlinks=False,
    )
    path = Path(downloaded)
    if not path.exists():
        raise SystemExit(f"Download reported success but file was not found: {path}")
    print(str(path))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

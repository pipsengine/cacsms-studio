# CACSMS Local Neural Image Renderer

This folder contains the private local image renderer that CACSMS can call via
`CACSMS_LOCAL_IMAGE_RENDER_COMMAND`.

Runtime contract:

```text
python render.py --prompt-file prompt.txt --output output.png --width 1280 --height 720 --seed 123
```

The renderer writes one PNG to `--output`. CACSMS validates the PNG, stores it
under `.generated/visuals`, and records the provider as:

```text
cacsms-local-neural-image-runtime
```

## Install

Use Python 3.12 or 3.11. This machine already has an Astral `uv` Python 3.12
runtime, so the recommended install is:

```powershell
cd C:\Content-Generation\cacsms-studio\local-models\image-renderer
uv venv --python 3.12 .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

## Model

Set `CACSMS_LOCAL_IMAGE_MODEL_ID` to a local model directory or a model id that
has been cached locally. For private/offline operation, download the model
weights once and keep them on this server, then point to the local directory.

Useful environment variables:

```text
CACSMS_LOCAL_IMAGE_MODEL_ID=C:\LocalModels\stable-diffusion
CACSMS_LOCAL_IMAGE_STEPS=20
CACSMS_LOCAL_IMAGE_GUIDANCE=7.5
CACSMS_LOCAL_IMAGE_DEVICE=cpu
CACSMS_LOCAL_IMAGE_OFFLINE=1
```

No hosted generation provider is used. If the local renderer is not configured
or fails, CACSMS falls back to the built-in offline procedural renderer.

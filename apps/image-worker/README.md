# Image Worker

Offline CACSMS image generation worker for independent visual synthesis.

This package is intentionally local-first: it does not call external image APIs, stock libraries, or hosted model providers. The default renderer creates original prompt-seeded PNG images with human figures, 3D data objects, enterprise dashboards, depth, lighting, and texture.

Current mode:

- `cacsms-autonomous-procedural-visual-engine`
- `CACSMS Original Human/3D Scene Renderer v2`
- Fully deterministic and offline
- Suitable as the guaranteed fallback renderer for every CACSMS installation

Future local-only extension point:

- Add local GPU/neural model inference behind the same worker contract.
- Store model weights on the CACSMS server.
- Keep generation private and independent from external providers.

The web runtime now supports a local executable neural adapter through:

```text
CACSMS_LOCAL_IMAGE_RENDER_COMMAND
CACSMS_LOCAL_IMAGE_RENDER_ARGS
CACSMS_LOCAL_IMAGE_MODEL_DIR
CACSMS_LOCAL_IMAGE_MODEL_NAME
CACSMS_LOCAL_IMAGE_RENDER_TIMEOUT_MS
```

The executable receives a prompt file, output path, width, height, and seed,
then writes a PNG to the requested output path. If the local command is absent
or fails, CACSMS falls back to the deterministic offline renderer so production
does not block.

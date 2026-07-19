# IIS Deployment

CACSMS Studio is configured for IIS hosting on port `3008`.

## Requirements

- Windows Server with IIS enabled
- Node.js 20 or newer
- pnpm 9.15.4
- NSSM (the Non-Sucking Service Manager), either available on `PATH` or staged with `install-nssm.ps1`
- IIS URL Rewrite module
- IIS Application Request Routing with proxy enabled

## Build

```powershell
cd C:\Content-Generation\cacsms-studio
pnpm install
pnpm build:web
```

## Install IIS Site

Run PowerShell as Administrator:

```powershell
cd C:\Content-Generation\cacsms-studio
pnpm iis:install
```

This creates or updates:

- Site: `cacsms-studio`
- App pool: `cacsms-studio`
- Physical path: `C:\Content-Generation\cacsms-studio`
- HTTP binding: `*:3008`

## Install Node Runtime Service

The current server has URL Rewrite available but does not have `iisnode` installed. CACSMS Studio therefore uses the standard IIS reverse-proxy model:

- IIS public port: `3008`
- Node internal port: `3018`

Run PowerShell as Administrator:

```powershell
powershell -ExecutionPolicy Bypass -File infrastructure/deployment/iis/install-node-windows-service.ps1
```

If NSSM is not installed yet, stage it first:

```powershell
powershell -ExecutionPolicy Bypass -File infrastructure/deployment/iis/install-nssm.ps1
powershell -ExecutionPolicy Bypass -File infrastructure/deployment/iis/install-node-windows-service.ps1
```

Do not use the sample placeholder path `C:\path\to\nssm.exe`. If NSSM is in a custom location, pass the real full path:

```powershell
powershell -ExecutionPolicy Bypass -File infrastructure/deployment/iis/install-node-windows-service.ps1 -NssmPath "C:\Tools\nssm\nssm.exe"
```

Run the service installer from an elevated PowerShell session. It configures the
`cacsms-studio-node` service for automatic startup, restart on failure, and logs
under `logs/`.

The installer also sets `CACSMS_PROJECT_ROOT` to the repository root. Keep this
environment variable in place; the independent image generator uses it to write
durable generated PNGs outside `.next/standalone`.

## Verify

```powershell
pnpm iis:verify
```

Expected health URL:

```text
http://localhost:3008/api/health
```

## Local Production Start Without IIS

```powershell
set NODE_ENV=production
pnpm build:web
pnpm start
```

The standalone Node server defaults to internal port `3018` for IIS reverse proxy. IIS owns the public `3008` binding.

## Independent Image Generation

CACSMS Studio generates visual assets locally by default. The built-in engine is:

```text
cacsms-autonomous-procedural-visual-engine
CACSMS Original Human/3D Scene Renderer v2
```

It does not call external image APIs, stock image services, or hosted model
providers. Generated assets are stored under:

```text
C:\Content-Generation\cacsms-studio\.generated\visuals
```

Future local GPU/neural image inference should be added behind the same local
worker contract in `apps/image-worker`, while keeping generation private and
independent.

Optional private neural image runtime:

```text
CACSMS_LOCAL_IMAGE_RENDER_COMMAND=C:\LocalModels\image-renderer\render.exe
CACSMS_LOCAL_IMAGE_RENDER_ARGS=--prompt-file {promptFile} --output {outputFile} --width {width} --height {height} --seed {seed}
CACSMS_LOCAL_IMAGE_MODEL_DIR=C:\LocalModels\image-renderer
CACSMS_LOCAL_IMAGE_MODEL_NAME=CACSMS Private Photoreal Model
CACSMS_LOCAL_IMAGE_RENDER_TIMEOUT_MS=120000
```

The command must be a local executable and must write a PNG file to
`{outputFile}`. CACSMS validates the PNG, persists it under `.generated`, and
records the provider as `cacsms-local-neural-image-runtime`. If no command is
configured, the built-in offline renderer remains the fallback.

## Independent Scene Video Packages

Scene-video generation also runs locally. When storyboard, narration cues, and a
verified image asset are available, the scene-video scheduler persists an HTML5
motion package with camera movement, timing, approved visual source, checksum,
and timeline routing metadata.

```text
CACSMS Independent HTML5 Motion Renderer v1
C:\Content-Generation\cacsms-studio\.generated\scene-video
```

No hosted video generation provider is required for this package path. A local
FFmpeg or local neural video renderer can later be added behind the same
durable storage and checksum contract when MP4 output is required.

## Independent Audio Generation

Narration and music generation also persist local WAV assets without hosted
voice or music providers.

```text
CACSMS Independent Local Narration Synthesizer v1
CACSMS Independent Local Score Composer v1
C:\Content-Generation\cacsms-studio\.generated\audio
```

The narration renderer creates deterministic speech-shaped PCM audio from the
approved transcript. The music renderer creates an original score bed from cue
timing, BPM, and production style. Both routes verify checksums before serving
the generated WAV asset.

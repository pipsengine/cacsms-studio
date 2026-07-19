from __future__ import annotations

import json
import os
import tempfile
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from render import load_diffusion_pipeline, run_diffusion_inference


class RenderDaemonState:
    def __init__(self) -> None:
        self.started_at = time.time()
        self.model_loaded = False
        self.model_error: str | None = None
        self.render_lock = threading.Lock()
        self.active_render = False
        self.completed_renders = 0
        self.failed_renders = 0


STATE = RenderDaemonState()


def warm_model() -> None:
    try:
        load_diffusion_pipeline()
        STATE.model_loaded = True
        print("cacsms.render-daemon.model-ready", flush=True)
    except Exception as exc:
        STATE.model_error = str(exc)
        print(f"cacsms.render-daemon.model-failed {exc}", flush=True)


class RenderDaemonHandler(BaseHTTPRequestHandler):
    server_version = "CACSMSLocalImageRenderDaemon/1.0"

    def log_message(self, format: str, *args) -> None:
        print(f"cacsms.render-daemon {self.address_string()} - {format % args}", flush=True)

    def _send_json(self, status: int, payload: dict) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:
        if self.path.rstrip("/") != "/health":
            self._send_json(404, {"status": "not_found"})
            return

        self._send_json(
            200,
            {
                "status": "ok" if STATE.model_loaded else "loading",
                "modelLoaded": STATE.model_loaded,
                "modelError": STATE.model_error,
                "activeRender": STATE.active_render,
                "completedRenders": STATE.completed_renders,
                "failedRenders": STATE.failed_renders,
                "uptimeSeconds": round(time.time() - STATE.started_at, 1),
                "device": os.environ.get("CACSMS_LOCAL_IMAGE_DEVICE", "cpu"),
            },
        )

    def do_POST(self) -> None:
        if self.path.rstrip("/") != "/render":
            self._send_json(404, {"status": "not_found"})
            return

        if not STATE.model_loaded:
            self._send_json(
                503,
                {
                    "status": "model_not_ready",
                    "message": STATE.model_error or "Diffusion model is still loading.",
                },
            )
            return

        length = int(self.headers.get("Content-Length", "0") or "0")
        raw = self.rfile.read(length) if length > 0 else b"{}"
        try:
            payload = json.loads(raw.decode("utf-8"))
        except json.JSONDecodeError:
            self._send_json(400, {"status": "invalid_json"})
            return

        prompt = str(payload.get("prompt", "")).strip()
        width = int(payload.get("width", 1280))
        height = int(payload.get("height", 720))
        seed = str(payload.get("seed", "seed"))
        if not prompt:
            self._send_json(400, {"status": "prompt_required"})
            return

        acquired = STATE.render_lock.acquire(blocking=False)
        if not acquired:
            self._send_json(409, {"status": "busy", "message": "Another local render is already running."})
            return

        STATE.active_render = True
        tmp_dir = tempfile.mkdtemp(prefix="cacsms-render-daemon-")
        output = Path(tmp_dir) / "output.png"
        try:
            pipe = load_diffusion_pipeline()
            run_diffusion_inference(pipe, prompt, output, width, height, seed)
            png = output.read_bytes()
            STATE.completed_renders += 1
            self.send_response(200)
            self.send_header("Content-Type", "image/png")
            self.send_header("Content-Length", str(len(png)))
            self.send_header("X-CACSMS-Render-Method", "warm-local-diffusion-daemon")
            self.end_headers()
            self.wfile.write(png)
        except Exception as exc:
            STATE.failed_renders += 1
            self._send_json(500, {"status": "render_failed", "message": str(exc)})
        finally:
            STATE.active_render = False
            STATE.render_lock.release()
            try:
                for child in Path(tmp_dir).iterdir():
                    child.unlink(missing_ok=True)
                Path(tmp_dir).rmdir()
            except OSError:
                pass


def main() -> int:
    host = os.environ.get("CACSMS_LOCAL_IMAGE_DAEMON_HOST", "127.0.0.1")
    port = int(os.environ.get("CACSMS_LOCAL_IMAGE_DAEMON_PORT", "3025"))
    print(f"cacsms.render-daemon.starting host={host} port={port}", flush=True)
    warm_model()
    server = ThreadingHTTPServer((host, port), RenderDaemonHandler)
    print(f"cacsms.render-daemon.listening http://{host}:{port}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("cacsms.render-daemon.stopping", flush=True)
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

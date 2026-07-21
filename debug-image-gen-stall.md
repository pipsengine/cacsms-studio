# Debug Session: image-gen-stall
- **Status**: [OPEN]
- **Issue**: Visual Studio image generation is not producing usable images; UI shows degraded state and stalled/blank output.
- **Debug Server**: http://127.0.0.1:7777/event
- **Log File**: `.dbg/trae-debug-log-image-gen-stall.ndjson`

## Reproduction Steps
1. Open `http://localhost:3008/visuals/image-generator`.
2. Observe the degraded banner and the image-generation workspace state.
3. Attempt to generate or inspect the active visual production.
4. Confirm whether a real image asset is created, approved, and visible in the workspace.

## Hypotheses & Verification
| ID | Hypothesis | Likelihood | Effort | Evidence |
|----|------------|------------|--------|----------|
| A | Provider health or local model readiness is degraded, causing generation/review failure. | High | Med | Confirmed |
| B | Session/bootstrap/auth state is blocking new mutation requests from the UI. | Med | Low | Pending |
| C | Lease expiry or reclaim churn prevents a generation job from completing. | Med | Med | Rejected |
| D | Asset bytes are produced, but technical validation or browser verification rejects them. | High | Med | Confirmed |
| E | The workspace is rendering stale persisted records rather than current job outcomes. | Med | Med | Rejected |

## Log Evidence
- Instrumentation added to:
  - `apps/web/app/api/visuals/image-generator/route.ts`
  - `apps/web/lib/image-generator-engine.ts`
- Pre-fix scheduler repro from direct `tsx` execution crashed in `pngHumanPixelEvidence()` with:
  - `ENOENT: no such file or directory, open 'C:\Next-Generation\cacsms-studio\apps\web\.next\standalone\apps\web\.generated\visuals\7DCD6681-0681-F111-8DC2-0093372AF0A2\variant-1-15521f333531.png'`
- Debug server captured:
  - `scheduler candidates prepared` with `candidates=10`, `activeCandidates=10`
  - `lease claim attempted` with `claimed=true`, `priorState=Completed`
  - `provider health and routing evaluated` with `reachable=false`, `modelLoaded=false`, `provider=cacsms-local-neural-image-runtime`
- Post-fix scheduler repro no longer crashes on missing persisted PNGs.
- Post-fix direct scheduler output reached provider execution and failed with:
  - `Real image generation is not configured. Set CACSMS_LOCAL_IMAGE_DAEMON_URL or CACSMS_LOCAL_IMAGE_RENDER_COMMAND before using the autonomous image generator.`
- Local runtime validation on the server confirmed:
  - `http://127.0.0.1:3025/health` unavailable
  - `local-models/image-renderer/.venv` absent before provisioning
  - no local model files present under `local-models/image-renderer/models`
- After SDXL provisioning:
  - `http://127.0.0.1:3025/health` returned `modelLoaded=true`
  - the daemon accepted real render requests and reported `activeRender=true`
  - the node service env confirmed `CACSMS_LOCAL_IMAGE_DAEMON_URL=http://127.0.0.1:3025`
  - the node service env confirmed `CACSMS_LOCAL_IMAGE_RENDER_TIMEOUT_MS=3600000`
- Live production evidence showed the queue could still display `state=Generating` with `browserLoadStatus=pending` and no persisted asset URL.
- Follow-up polling captured a stale-state symptom:
  - one poll returned daemon `activeRender=false`, `completedRenders=0`, `failedRenders=5` while the top production still reported `state=Generating`
  - a later poll returned daemon `activeRender=true`, confirming real renders do occur but queue state could outlive daemon activity
- Root-cause refinement:
  - the local provider was not simply "down"; instead, local CPU renders are very slow and the queue state machine could preserve `Generating` long after no daemon render was active.

## Verification Conclusion
- Pre-fix: scheduler stopped during re-validation of a legacy completed variant because missing persisted PNG files threw uncaught filesystem errors.
- Post-fix: scheduler survives the legacy-file path and advances far enough to confirm the remaining production blocker is unprovisioned local image generation infrastructure on this server.
- Current active remediation:
  1. provision Python 3.12 virtual environment for `local-models/image-renderer`
  2. install diffusion/runtime dependencies
  3. download the configured photoreal model
  4. apply IIS/Windows-service local-image configuration and rerun the scheduler
  5. patch stale local-generation recovery so jobs only remain `Generating` when the daemon is actually active or within a short grace window

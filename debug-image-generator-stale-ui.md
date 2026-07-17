# Debug Session: image-generator-stale-ui

## Status
- [OPEN] Investigating why `http://localhost:3008/visuals/image-generator` still shows the old sparse layout after the workspace implementation changed locally.

## Symptoms
- User reports "nothing changed" after the image-generator workspace redesign was implemented.
- Expected result: full attachment-1 autonomous console on `/visuals/image-generator`.
- Actual result: page still appears unchanged in the browser.

## Initial Hypotheses
1. The IIS/NSSM-backed Node service on port `3008` is still serving an older build and has not picked up the latest compiled assets.
2. The latest source change compiled locally, but the production build artifacts being served by the service do not include the updated `AutonomousImageGeneratorWorkspace`.
3. Browser caching is pinning old `/_next/static/*` assets or the current route is resolving to a different bundle than expected.
4. The route is rendering a different component or data path than the one edited, so the updated workspace code is not actually the code serving `/visuals/image-generator`.
5. The service restarted against a stale working directory or stale `.next/standalone` output, so the new source never reached the running runtime.

## Evidence Log
- `cacsms-studio-node` service is running under NSSM and launches `C:\Next-Generation\cacsms-studio\server.js`.
- Current source file timestamp: `apps/web/features/visuals/AutonomousImageGeneratorWorkspace.tsx` updated at `2026-07-17 11:03:11`.
- Current standalone server artifact timestamp: `apps/web/.next/standalone/apps/web/server.js` updated at `2026-07-17 11:09:07`.
- New waiting-console markers (`QUEUE-WAIT`, `Awaiting eligible production candidate`) are present in the current `.next` build output.
- Live HTML from `http://localhost:3008/visuals/image-generator` still contains the old empty-state markup:
  - old subtitle: `Production-driven visual generation, validation, revision, and asset routing.`
  - old empty-state branch: `No persisted image generation candidate is available.`
  - old client chunk: `9946-ceff101501f1ad06.js`
- Therefore the running service is serving an older bundle than the newly built `.next` output on disk.

## Next Actions
- Restart the Windows service so the running Node process loads the new `.next` output.
- Re-check the live HTML and chunk reference after restart.

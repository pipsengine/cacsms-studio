# Debug Session: missing-static-assets [OPEN]

## Summary
- Symptom: browser reports `404` for `webpack.js`, `main.js`, `react-refresh.js`, `_app.js`, `_error.js`, plus `500` for `/favicon.ico` on `:3008`.
- Scope: active public runtime on port `3008`.
- Context: recent rebuilds and production/runtime alignment changes.

## Falsifiable Hypotheses
1. Port `3008` is currently serving HTML generated for Next dev mode, but the actual runtime is not exposing the matching dev asset endpoints.
2. The active process behind `3008` is using stale or partial `.next` output, so required static files referenced by the HTML no longer exist.
3. IIS or the custom Node host is proxying to the wrong internal runtime, causing a mismatch between emitted asset URLs and the process actually serving them.
4. The app is running in production with a request path/base mismatch, so static asset requests are resolving to non-existent locations.
5. The favicon `500` is a secondary symptom from the same runtime mismatch rather than a standalone asset bug.

## Evidence Log
- `http://localhost:3008/visuals/image-generator` returned a Next error payload with `buildId: "development"` and a `DevServer` stack.
- The same response contained `Cannot find module './383.js'` from `apps/web/.next/server/webpack-runtime.js`.
- `apps/web/.next/server/chunks/383.js` exists on disk, so the failure was not a missing emitted chunk.
- `http://localhost:3008/_next/static/chunks/react-refresh.js` returned `404`, consistent with a production asset set being served through a development-oriented runtime/error path.
- Running the root custom host with `NODE_ENV` unset reproduced the broken bootstrap before the fix.
- Running the root custom host after the fix served `http://127.0.0.1:3013/visuals/image-generator` with `200`, `Autonomous Image Generator`, no `development` marker, and `favicon.ico => 200`.

## Instrumentation
- Added temporary runtime verification by booting the custom host on an alternate port (`3013`) with `NODE_ENV` unset and exercising the image-generator page plus key static assets.

## Fix
- Hardened `server.js` so the custom host defaults to production unless `NODE_ENV=development` is explicit.
- In production on a numeric port, `server.js` now delegates to Next's emitted standalone server at `apps/web/.next/standalone/apps/web/server.js` instead of booting `next()` directly against the standalone output.
- Updated the root `start` script to launch the IIS/internal runtime in production mode by default.

## Verification
- `server.js` starts successfully on `3013` with `NODE_ENV` unset.
- `http://127.0.0.1:3013/visuals/image-generator` returns `200`.
- `http://127.0.0.1:3013/favicon.ico` returns `200`.
- `http://127.0.0.1:3013/_next/static/chunks/react-refresh.js` returns `404`, which is correct for production.

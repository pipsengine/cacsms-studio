# Debug Session: static-asset-400
- **Status**: [OPEN]
- **Issue**: The live runtime on `http://localhost:3008` is returning `400 Bad Request` for multiple `/_next/static/css/*` and `/_next/static/chunks/*` assets.
- **Debug Server**: Pending
- **Log File**: `.dbg/trae-debug-log-static-asset-400.ndjson`

## Reproduction Steps
1. Open `http://localhost:3008/production-workflow/produce`.
2. Observe repeated `400 Bad Request` responses for `/_next/static/css/*` and `/_next/static/chunks/*`.
3. Compare the hashes referenced by the served HTML with the current `.next/static` files on disk.
4. Verify whether `3008` and `3018` both fail for the same asset URLs.

## Hypotheses & Verification
| ID | Hypothesis | Likelihood | Effort | Evidence |
|----|------------|------------|--------|----------|
| A | The live service is serving HTML that references stale webpack/CSS hashes not present in the current `.next/static` output. | High | Low | Pending |
| B | The Windows service is running from the wrong working tree or stale artifact root again. | High | Med | Pending |
| C | The `.next` output is partial/corrupt, so the page shell renders while static chunks are missing. | High | Med | Pending |
| D | IIS or the Node server is mishandling `/_next/static/*` requests and returning `400` for valid files. | Med | Med | Pending |
| E | The browser is pinned to old HTML and is requesting hashes that no longer exist after a rebuild/restart. | Med | Low | Pending |

## Log Evidence
- Pending evidence collection.

## Verification Conclusion
- Pending pre-fix analysis.

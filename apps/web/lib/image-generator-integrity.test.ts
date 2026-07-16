import test from "node:test";
import assert from "node:assert/strict";
import { createVisualAssetUrl, getCompletedVariantIntegrityErrors, validateServedImageResponse } from "./image-generator-integrity";

test("completed variants require a persisted asset id, checksum, dimensions, and browser-loaded URL", () => {
  const errors = getCompletedVariantIntegrityErrors({
    state: "Completed",
    assetId: null,
    assetUrl: "/api/visuals/image-generator/assets/not-a-guid",
    fileSizeBytes: 0,
    checksumSha256: "bad",
    width: 0,
    height: 0,
    mimeType: "text/plain",
    browserLoadStatus: "pending"
  });

  assert.deepEqual(errors, [
    "Completed variants must reference a persisted asset ID.",
    "Completed variants must expose a loadable authenticated asset URL.",
    "Completed variants must have a non-zero persisted file size.",
    "Completed variants must include a SHA-256 checksum.",
    "Completed variants must include valid image dimensions.",
    "Completed variants must persist a PNG or WebP MIME type.",
    "Completed variants must only be marked complete after the browser loads the asset URL."
  ]);
});

test("completed variants pass integrity when the persisted asset is fully valid", () => {
  const assetId = "11111111-2222-3333-4444-555555555555";
  const errors = getCompletedVariantIntegrityErrors({
    state: "Completed",
    assetId,
    assetUrl: createVisualAssetUrl(assetId),
    fileSizeBytes: 4096,
    checksumSha256: "a".repeat(64),
    width: 1280,
    height: 720,
    mimeType: "image/png",
    browserLoadStatus: "loaded"
  });

  assert.deepEqual(errors, []);
});

test("served image validation rejects empty or mistyped responses", () => {
  assert.deepEqual(
    validateServedImageResponse({
      ok: false,
      contentType: "text/html",
      byteLength: 0,
      expectedMimeType: "image/png"
    }),
    [
      "The persisted asset URL did not return a successful response.",
      "The persisted asset response returned an unexpected Content-Type.",
      "The persisted asset response returned empty image bytes."
    ]
  );
});

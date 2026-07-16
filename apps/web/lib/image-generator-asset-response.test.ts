import test from "node:test";
import assert from "node:assert/strict";
import { createImageAssetResponse } from "./image-generator-asset-response";
import { generatePromptPng } from "./image-generator-png";

test("asset responses return real image bytes with the correct content type", async () => {
  const image = generatePromptPng("asset response bytes", 320, 180);
  const response = createImageAssetResponse({
    bytes: image.bytes,
    mimeType: "image/png",
    fileName: "variant-1.png",
    checksumSha256: image.checksum
  });
  const bytes = Buffer.from(await response.arrayBuffer());

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "image/png");
  assert.equal(response.headers.get("content-length"), String(image.bytes.length));
  assert.equal(response.headers.get("x-asset-checksum-sha256"), image.checksum);
  assert.equal(bytes.equals(image.bytes), true);
});

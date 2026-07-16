import test from "node:test";
import assert from "node:assert/strict";
import { generatePromptPng, readPngDimensions } from "./image-generator-png";

test("prompt png generation returns non-zero bytes, checksum, and persisted dimensions", () => {
  const image = generatePromptPng("enterprise autonomous image prompt", 640, 360);
  const dimensions = readPngDimensions(image.bytes);

  assert.equal(image.bytes.length > 0, true);
  assert.equal(image.width, 640);
  assert.equal(image.height, 360);
  assert.equal(dimensions.width, 640);
  assert.equal(dimensions.height, 360);
  assert.match(image.checksum, /^[0-9a-f]{64}$/);
});

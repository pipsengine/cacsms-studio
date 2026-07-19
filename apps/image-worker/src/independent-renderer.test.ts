import test from "node:test";
import assert from "node:assert/strict";
import { renderIndependentImage } from "./independent-renderer";

test("independent renderer creates original png bytes without remote services", () => {
  const result = renderIndependentImage({
    prompt: "human operations team in a 3D industrial AI command center",
    width: 640,
    height: 360,
    seed: "test"
  });

  assert.equal(result.width, 640);
  assert.equal(result.height, 360);
  assert.equal(result.provider, "cacsms-autonomous-procedural-visual-engine");
  assert.equal(result.model, "CACSMS Original Human/3D Scene Renderer v2");
  assert.match(result.checksumSha256, /^[0-9a-f]{64}$/);
  assert.equal(result.bytes.subarray(1, 4).toString("ascii"), "PNG");
  assert.equal(result.bytes.length > 1000, true);
});

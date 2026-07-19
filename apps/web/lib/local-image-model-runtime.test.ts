import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { renderWithLocalImageModel } from "@/lib/local-image-model-runtime";

const onePixelPng =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=";

test("local image model runtime returns null when no local command is configured", async () => {
  const previous = process.env.CACSMS_LOCAL_IMAGE_RENDER_COMMAND;
  delete process.env.CACSMS_LOCAL_IMAGE_RENDER_COMMAND;
  try {
    const result = await renderWithLocalImageModel({ prompt: "test", width: 64, height: 64, seed: "seed" });
    assert.equal(result, null);
  } finally {
    if (previous) process.env.CACSMS_LOCAL_IMAGE_RENDER_COMMAND = previous;
  }
});

test("local image model runtime executes a local command and validates PNG output", async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "cacsms-local-model-test-"));
  const script = path.join(tmp, "renderer.cjs");
  await fs.writeFile(
    script,
    `const fs=require("fs");fs.writeFileSync(process.env.CACSMS_IMAGE_OUTPUT_FILE, Buffer.from("${onePixelPng}","base64"));`
  );
  const previousCommand = process.env.CACSMS_LOCAL_IMAGE_RENDER_COMMAND;
  const previousArgs = process.env.CACSMS_LOCAL_IMAGE_RENDER_ARGS;
  const previousName = process.env.CACSMS_LOCAL_IMAGE_MODEL_NAME;
  try {
    process.env.CACSMS_LOCAL_IMAGE_RENDER_COMMAND = process.execPath;
    process.env.CACSMS_LOCAL_IMAGE_RENDER_ARGS = `"${script}"`;
    process.env.CACSMS_LOCAL_IMAGE_MODEL_NAME = "Unit Test Local Model";
    const result = await renderWithLocalImageModel({ prompt: "local human image", width: 64, height: 64, seed: "seed" });
    assert.ok(result);
    assert.equal(result.provider, "cacsms-local-neural-image-runtime");
    assert.equal(result.model, "Unit Test Local Model");
    assert.equal(result.width, 1);
    assert.equal(result.height, 1);
    assert.match(result.checksum, /^[0-9a-f]{64}$/);
  } finally {
    if (previousCommand) process.env.CACSMS_LOCAL_IMAGE_RENDER_COMMAND = previousCommand;
    else delete process.env.CACSMS_LOCAL_IMAGE_RENDER_COMMAND;
    if (previousArgs) process.env.CACSMS_LOCAL_IMAGE_RENDER_ARGS = previousArgs;
    else delete process.env.CACSMS_LOCAL_IMAGE_RENDER_ARGS;
    if (previousName) process.env.CACSMS_LOCAL_IMAGE_MODEL_NAME = previousName;
    else delete process.env.CACSMS_LOCAL_IMAGE_MODEL_NAME;
    await fs.rm(tmp, { recursive: true, force: true });
  }
});

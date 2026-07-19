import crypto from "node:crypto";
import zlib from "node:zlib";

export type IndependentImageRequest = {
  prompt: string;
  width: number;
  height: number;
  seed?: string;
};

export type IndependentImageResult = {
  bytes: Buffer;
  width: number;
  height: number;
  checksumSha256: string;
  provider: "cacsms-autonomous-procedural-visual-engine";
  model: "CACSMS Original Human/3D Scene Renderer v2";
};

const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const crcTable = new Uint32Array(256).map((_, index) => {
  let crc = index;
  for (let bit = 0; bit < 8; bit += 1) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  return crc >>> 0;
});

function crc32(buffer: Buffer) {
  let crc = 0xffffffff;
  for (const value of buffer) crc = crcTable[(crc ^ value) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer) {
  const typeBytes = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])), 0);
  return Buffer.concat([length, typeBytes, data, checksum]);
}

function clamp(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function setPixel(rows: Buffer, width: number, height: number, x: number, y: number, r: number, g: number, b: number, a = 255) {
  if (x < 0 || y < 0 || x >= width || y >= height) return;
  const offset = y * (width * 4 + 1) + 1 + x * 4;
  const alpha = a / 255;
  rows[offset] = clamp(rows[offset] * (1 - alpha) + r * alpha);
  rows[offset + 1] = clamp(rows[offset + 1] * (1 - alpha) + g * alpha);
  rows[offset + 2] = clamp(rows[offset + 2] * (1 - alpha) + b * alpha);
  rows[offset + 3] = 255;
}

function ellipse(rows: Buffer, width: number, height: number, cx: number, cy: number, rx: number, ry: number, color: [number, number, number, number]) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y += 1) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x += 1) {
      const nx = (x - cx) / Math.max(rx, 1);
      const ny = (y - cy) / Math.max(ry, 1);
      if (nx * nx + ny * ny <= 1) setPixel(rows, width, height, x, y, ...color);
    }
  }
}

function rect(rows: Buffer, width: number, height: number, x: number, y: number, w: number, h: number, color: [number, number, number, number]) {
  for (let py = Math.max(0, Math.floor(y)); py < Math.min(height, Math.ceil(y + h)); py += 1) {
    for (let px = Math.max(0, Math.floor(x)); px < Math.min(width, Math.ceil(x + w)); px += 1) setPixel(rows, width, height, px, py, ...color);
  }
}

function line(rows: Buffer, width: number, height: number, x1: number, y1: number, x2: number, y2: number, thickness: number, color: [number, number, number, number]) {
  const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1), 1);
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    ellipse(rows, width, height, x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, thickness, thickness, color);
  }
}

function drawHuman(rows: Buffer, width: number, height: number, cx: number, baseY: number, scale: number, seed: Buffer, index: number) {
  const skins = [[96, 57, 42], [171, 108, 72], [223, 166, 117], [126, 82, 57]];
  const jackets = [[19, 41, 70], [49, 58, 115], [21, 86, 102], [72, 48, 101]];
  const skin = skins[seed[index] % skins.length];
  const jacket = jackets[seed[index + 8] % jackets.length];
  ellipse(rows, width, height, cx, baseY + 6 * scale, 45 * scale, 10 * scale, [2, 8, 18, 100]);
  ellipse(rows, width, height, cx, baseY - 148 * scale, 26 * scale, 32 * scale, [skin[0], skin[1], skin[2], 255]);
  ellipse(rows, width, height, cx, baseY - 176 * scale, 26 * scale, 12 * scale, [29, 23, 31, 245]);
  ellipse(rows, width, height, cx - 9 * scale, baseY - 153 * scale, 2.5 * scale, 2.5 * scale, [5, 12, 22, 255]);
  ellipse(rows, width, height, cx + 9 * scale, baseY - 153 * scale, 2.5 * scale, 2.5 * scale, [5, 12, 22, 255]);
  line(rows, width, height, cx - 8 * scale, baseY - 134 * scale, cx + 8 * scale, baseY - 134 * scale, 1.3 * scale, [113, 50, 47, 190]);
  ellipse(rows, width, height, cx, baseY - 95 * scale, 40 * scale, 56 * scale, [jacket[0], jacket[1], jacket[2], 255]);
  rect(rows, width, height, cx - 13 * scale, baseY - 143 * scale, 26 * scale, 62 * scale, [232, 239, 247, 235]);
  line(rows, width, height, cx, baseY - 139 * scale, cx, baseY - 88 * scale, 3 * scale, index % 2 ? [70, 207, 245, 230] : [124, 90, 255, 230]);
}

export function renderIndependentImage(input: IndependentImageRequest): IndependentImageResult {
  const width = Math.max(64, Math.round(input.width));
  const height = Math.max(64, Math.round(input.height));
  const seed = crypto.createHash("sha256").update(`${input.prompt}\n${input.seed ?? ""}`).digest();
  const rows = Buffer.alloc((width * 4 + 1) * height);

  for (let y = 0; y < height; y += 1) {
    const rowOffset = y * (width * 4 + 1);
    rows[rowOffset] = 0;
    for (let x = 0; x < width; x += 1) {
      const offset = rowOffset + 1 + x * 4;
      const hx = x / Math.max(width - 1, 1);
      const hy = y / Math.max(height - 1, 1);
      const glow = Math.max(0, 1 - Math.hypot(hx - 0.56, hy - 0.36) * 2.2);
      const grain = (((x * 73856093) ^ (y * 19349663) ^ seed[(x + y) & 31]) & 31) - 15;
      rows[offset] = clamp(10 + 48 * hx + 55 * glow + grain);
      rows[offset + 1] = clamp(23 + 44 * hy + 78 * glow + grain * 0.7);
      rows[offset + 2] = clamp(50 + 76 * (1 - hy) + 92 * glow + grain * 0.5);
      rows[offset + 3] = 255;
    }
  }

  rect(rows, width, height, width * 0.13, height * 0.17, width * 0.23, height * 0.22, [8, 31, 54, 228]);
  rect(rows, width, height, width * 0.52, height * 0.13, width * 0.36, height * 0.28, [8, 31, 54, 228]);
  for (let i = 0; i < 11; i += 1) {
    rect(rows, width, height, width * (0.15 + i * 0.018), height * (0.31 - (seed[i] % 65) / 420), width * 0.01, height * (0.05 + (seed[i] % 80) / 600), [70, 207, 245, 185]);
    rect(rows, width, height, width * (0.55 + i * 0.028), height * (0.32 - (seed[i + 9] % 90) / 430), width * 0.014, height * (0.06 + (seed[i + 9] % 90) / 520), [70, 207, 245, 185]);
  }
  rect(rows, width, height, width * 0.21, height * 0.64, width * 0.58, height * 0.055, [15, 28, 42, 220]);
  drawHuman(rows, width, height, width * 0.38, height * 0.72, 1.05, seed, 0);
  drawHuman(rows, width, height, width * 0.55, height * 0.71, 1.13, seed, 1);
  drawHuman(rows, width, height, width * 0.7, height * 0.73, 0.95, seed, 2);
  for (let i = 0; i < 8; i += 1) {
    const cx = width * (0.2 + i * 0.09);
    const cy = height * (0.48 + ((seed[i + 12] % 18) / 100));
    rect(rows, width, height, cx - width * 0.025, cy - width * 0.025, width * 0.05, width * 0.05, i % 2 ? [50, 187, 230, 150] : [119, 92, 255, 150]);
    line(rows, width, height, cx, cy, width * 0.55, height * 0.42, 1.2, [74, 218, 247, 80]);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const bytes = Buffer.concat([signature, chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(rows, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
  return {
    bytes,
    width,
    height,
    checksumSha256: crypto.createHash("sha256").update(bytes).digest("hex"),
    provider: "cacsms-autonomous-procedural-visual-engine",
    model: "CACSMS Original Human/3D Scene Renderer v2"
  };
}

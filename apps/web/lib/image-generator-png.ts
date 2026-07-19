import crypto from "node:crypto";
import zlib from "node:zlib";

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const crcTable = new Uint32Array(256).map((_, index) => {
  let crc = index;
  for (let shift = 0; shift < 8; shift += 1) {
    crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }
  return crc >>> 0;
});

export type GeneratedPng = {
  bytes: Buffer;
  width: number;
  height: number;
  averageLuma: number;
  checksum: string;
};

function crc32(buffer: Buffer) {
  let crc = 0xffffffff;
  for (const value of buffer) {
    crc = crcTable[(crc ^ value) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer) {
  const typeBytes = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([typeBytes, data]);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([length, body, checksum]);
}

type Rgba = readonly [number, number, number, number];

function clampByte(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function createPixel(seed: Buffer, x: number, y: number, width: number, height: number) {
  const horizontal = x / Math.max(width - 1, 1);
  const vertical = y / Math.max(height - 1, 1);
  const horizon = Math.max(0, vertical - 0.54);
  const light = Math.sin(horizontal * Math.PI * 1.2 + seed[4] / 80) * 0.5 + 0.5;
  const wallGlow = Math.max(0, 1 - Math.hypot(horizontal - 0.58, vertical - 0.36) * 2.2);
  const floorStripe = horizon > 0 && ((Math.floor((x + y * 0.7 + seed[5]) / Math.max(28, width / 28)) % 2) === 0);

  const red = 11 + 26 * horizontal + 40 * wallGlow + 18 * light + horizon * 54 + (floorStripe ? 12 : 0);
  const green = 24 + 34 * vertical + 64 * wallGlow + 8 * light + horizon * 36 + (floorStripe ? 8 : 0);
  const blue = 48 + 62 * (1 - vertical) + 82 * wallGlow + 12 * light + horizon * 16;

  return [clampByte(red), clampByte(green), clampByte(blue), 255] as const;
}

function addFilmGrain(rows: Buffer, width: number, height: number, seed: Buffer) {
  for (let y = 0; y < height; y += 1) {
    const rowOffset = y * (width * 4 + 1);
    for (let x = 0; x < width; x += 1) {
      const pixelOffset = rowOffset + 1 + x * 4;
      const hash = (x * 73856093) ^ (y * 19349663) ^ (seed[(x + y) & 31] * 83492791);
      const grain = ((hash & 31) - 15) * 0.9;
      const vignette = Math.hypot(x / width - 0.5, y / height - 0.46) * 42;
      rows[pixelOffset] = clampByte(rows[pixelOffset] + grain - vignette);
      rows[pixelOffset + 1] = clampByte(rows[pixelOffset + 1] + grain * 0.7 - vignette * 0.7);
      rows[pixelOffset + 2] = clampByte(rows[pixelOffset + 2] + grain * 0.55 - vignette * 0.35);
    }
  }
}

function blendPixel(rows: Buffer, width: number, height: number, x: number, y: number, color: Rgba) {
  if (x < 0 || y < 0 || x >= width || y >= height) return;
  const offset = y * (width * 4 + 1) + 1 + x * 4;
  const alpha = color[3] / 255;
  rows[offset] = clampByte(rows[offset] * (1 - alpha) + color[0] * alpha);
  rows[offset + 1] = clampByte(rows[offset + 1] * (1 - alpha) + color[1] * alpha);
  rows[offset + 2] = clampByte(rows[offset + 2] * (1 - alpha) + color[2] * alpha);
  rows[offset + 3] = 255;
}

function fillRect(rows: Buffer, width: number, height: number, x: number, y: number, w: number, h: number, color: Rgba) {
  const left = Math.max(0, Math.floor(x));
  const top = Math.max(0, Math.floor(y));
  const right = Math.min(width, Math.ceil(x + w));
  const bottom = Math.min(height, Math.ceil(y + h));
  for (let py = top; py < bottom; py += 1) {
    for (let px = left; px < right; px += 1) blendPixel(rows, width, height, px, py, color);
  }
}

function fillEllipse(rows: Buffer, width: number, height: number, cx: number, cy: number, rx: number, ry: number, color: Rgba) {
  const left = Math.floor(cx - rx);
  const right = Math.ceil(cx + rx);
  const top = Math.floor(cy - ry);
  const bottom = Math.ceil(cy + ry);
  for (let y = top; y <= bottom; y += 1) {
    for (let x = left; x <= right; x += 1) {
      const nx = (x - cx) / Math.max(rx, 1);
      const ny = (y - cy) / Math.max(ry, 1);
      if (nx * nx + ny * ny <= 1) blendPixel(rows, width, height, x, y, color);
    }
  }
}

function fillEllipseShaded(
  rows: Buffer,
  width: number,
  height: number,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  base: Rgba,
  light: Rgba,
  shadow: Rgba
) {
  const left = Math.floor(cx - rx);
  const right = Math.ceil(cx + rx);
  const top = Math.floor(cy - ry);
  const bottom = Math.ceil(cy + ry);
  for (let y = top; y <= bottom; y += 1) {
    for (let x = left; x <= right; x += 1) {
      const nx = (x - cx) / Math.max(rx, 1);
      const ny = (y - cy) / Math.max(ry, 1);
      const distance = nx * nx + ny * ny;
      if (distance > 1) continue;
      const highlight = Math.max(0, 1 - Math.hypot(nx + 0.32, ny + 0.38) * 1.7);
      const shade = Math.max(0, nx * 0.55 + ny * 0.35);
      blendPixel(rows, width, height, x, y, [
        clampByte(base[0] * (1 - shade) + shadow[0] * shade + light[0] * highlight * 0.18),
        clampByte(base[1] * (1 - shade) + shadow[1] * shade + light[1] * highlight * 0.18),
        clampByte(base[2] * (1 - shade) + shadow[2] * shade + light[2] * highlight * 0.18),
        base[3]
      ]);
    }
  }
}

function fillJacket(rows: Buffer, width: number, height: number, cx: number, top: number, shoulder: number, heightPx: number, color: Rgba) {
  for (let y = Math.floor(top); y < Math.ceil(top + heightPx); y += 1) {
    const progress = (y - top) / Math.max(1, heightPx);
    const half = shoulder * (1 - progress * 0.42);
    for (let x = Math.floor(cx - half); x <= Math.ceil(cx + half); x += 1) {
      const edge = Math.abs(x - cx) / Math.max(half, 1);
      const shade = 1 - edge * 0.35 - progress * 0.18;
      blendPixel(rows, width, height, x, y, [
        clampByte(color[0] * shade),
        clampByte(color[1] * shade),
        clampByte(color[2] * shade),
        color[3]
      ]);
    }
  }
}

function drawLine(rows: Buffer, width: number, height: number, x1: number, y1: number, x2: number, y2: number, thickness: number, color: Rgba) {
  const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1), 1);
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    fillEllipse(rows, width, height, x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, thickness, thickness, color);
  }
}

function drawPhotographicPerson(rows: Buffer, width: number, height: number, cx: number, baseY: number, scale: number, skin: Rgba, jacket: Rgba, seed: Buffer, index: number) {
  const light: Rgba = [255, 226, 196, 255];
  const skinShadow: Rgba = [72, 38, 30, 255];
  const headY = baseY - 162 * scale;
  const bodyTop = baseY - 114 * scale;
  fillEllipse(rows, width, height, cx, baseY + 8 * scale, 62 * scale, 12 * scale, [0, 5, 14, 120]);
  drawLine(rows, width, height, cx - 42 * scale, bodyTop + 18 * scale, cx - 78 * scale, bodyTop + 76 * scale, 12 * scale, jacket);
  drawLine(rows, width, height, cx + 42 * scale, bodyTop + 18 * scale, cx + 76 * scale, bodyTop + 62 * scale, 12 * scale, jacket);
  drawLine(rows, width, height, cx - 76 * scale, bodyTop + 76 * scale, cx - 43 * scale, bodyTop + 96 * scale, 7 * scale, skin);
  drawLine(rows, width, height, cx + 76 * scale, bodyTop + 62 * scale, cx + 98 * scale, bodyTop + 48 * scale, 7 * scale, skin);
  fillJacket(rows, width, height, cx, bodyTop, 54 * scale, 114 * scale, jacket);
  fillRect(rows, width, height, cx - 18 * scale, bodyTop + 4 * scale, 36 * scale, 80 * scale, [230, 237, 244, 235]);
  drawLine(rows, width, height, cx, bodyTop + 10 * scale, cx, bodyTop + 74 * scale, 3.5 * scale, index % 2 ? [67, 196, 228, 240] : [124, 90, 255, 235]);
  fillEllipseShaded(rows, width, height, cx, headY, 31 * scale, 39 * scale, skin, light, skinShadow);
  fillEllipse(rows, width, height, cx, headY - 31 * scale, 32 * scale, 13 * scale, [29, 24, 26, 248]);
  fillEllipse(rows, width, height, cx - 25 * scale, headY - 10 * scale, 8 * scale, 18 * scale, [29, 24, 26, 235]);
  fillEllipse(rows, width, height, cx + 24 * scale, headY - 9 * scale, 7 * scale, 17 * scale, [29, 24, 26, 225]);
  fillEllipse(rows, width, height, cx - 10 * scale, headY - 4 * scale, 2.2 * scale, 2.1 * scale, [4, 11, 21, 245]);
  fillEllipse(rows, width, height, cx + 10 * scale, headY - 4 * scale, 2.2 * scale, 2.1 * scale, [4, 11, 21, 245]);
  drawLine(rows, width, height, cx - 9 * scale, headY + 16 * scale, cx + 10 * scale, headY + 15 * scale, 1.4 * scale, [105, 44, 43, 185]);
  fillRect(rows, width, height, cx - 12 * scale, headY + 36 * scale, 24 * scale, 20 * scale, skin);
  drawLine(rows, width, height, cx - 17 * scale, baseY - 2 * scale, cx - 29 * scale, baseY + 42 * scale, 9 * scale, [17, 28, 47, 240]);
  drawLine(rows, width, height, cx + 17 * scale, baseY - 2 * scale, cx + 30 * scale, baseY + 42 * scale, 9 * scale, [17, 28, 47, 240]);
}

function drawPanel(rows: Buffer, width: number, height: number, x: number, y: number, w: number, h: number, seed: Buffer) {
  fillRect(rows, width, height, x, y, w, h, [8, 31, 54, 228]);
  fillRect(rows, width, height, x + w * 0.02, y + h * 0.04, w * 0.96, h * 0.88, [13, 83, 117, 210]);
  const columns = 7 + (seed[9] % 5);
  for (let i = 0; i < columns; i += 1) {
    const px = x + w * (0.08 + i / columns * 0.84);
    const barH = h * (0.18 + ((seed[i] % 90) / 255));
    fillRect(rows, width, height, px, y + h * 0.72 - barH, w * 0.035, barH, [70, 207, 245, 185]);
  }
  for (let i = 0; i < 9; i += 1) {
    drawLine(rows, width, height, x + w * 0.08, y + h * (0.14 + i * 0.07), x + w * (0.35 + (seed[i + 3] % 50) / 100), y + h * (0.14 + i * 0.07), 1.2, [154, 232, 255, 132]);
  }
}

function drawPerson(rows: Buffer, width: number, height: number, cx: number, baseY: number, scale: number, skin: Rgba, jacket: Rgba, seed: Buffer, index: number) {
  const headY = baseY - 148 * scale;
  const bodyY = baseY - 96 * scale;
  const shadow: Rgba = [1, 7, 16, 100];
  fillEllipse(rows, width, height, cx, baseY + 4 * scale, 42 * scale, 9 * scale, shadow);
  fillEllipse(rows, width, height, cx, headY, 25 * scale, 31 * scale, skin);
  fillEllipse(rows, width, height, cx, headY - 26 * scale, 25 * scale, 11 * scale, [31, 24, 31, 238]);
  fillRect(rows, width, height, cx - 10 * scale, headY + 27 * scale, 20 * scale, 20 * scale, skin);
  fillEllipse(rows, width, height, cx - 8 * scale, headY - 4 * scale, 2.2 * scale, 2.2 * scale, [7, 17, 28, 235]);
  fillEllipse(rows, width, height, cx + 9 * scale, headY - 4 * scale, 2.2 * scale, 2.2 * scale, [7, 17, 28, 235]);
  drawLine(rows, width, height, cx - 7 * scale, headY + 13 * scale, cx + 8 * scale, headY + 13 * scale, 1.2 * scale, [112, 52, 49, 190]);
  fillEllipse(rows, width, height, cx, bodyY, 39 * scale, 54 * scale, jacket);
  fillRect(rows, width, height, cx - 13 * scale, bodyY - 49 * scale, 26 * scale, 56 * scale, [229, 238, 247, 235]);
  const tie: Rgba = index % 2 ? [70, 207, 245, 230] : [124, 90, 255, 230];
  drawLine(rows, width, height, cx, bodyY - 45 * scale, cx, bodyY + 8 * scale, 3 * scale, tie);
  drawLine(rows, width, height, cx - 38 * scale, bodyY - 18 * scale, cx - 70 * scale, bodyY + 20 * scale + (seed[index] % 18) * scale, 8 * scale, jacket);
  drawLine(rows, width, height, cx + 38 * scale, bodyY - 18 * scale, cx + 71 * scale, bodyY + 4 * scale - (seed[index + 2] % 16) * scale, 8 * scale, jacket);
  drawLine(rows, width, height, cx - 18 * scale, bodyY + 47 * scale, cx - 30 * scale, baseY, 8 * scale, [21, 35, 57, 240]);
  drawLine(rows, width, height, cx + 18 * scale, bodyY + 47 * scale, cx + 28 * scale, baseY, 8 * scale, [21, 35, 57, 240]);
}

function drawCube(rows: Buffer, width: number, height: number, cx: number, cy: number, size: number, color: Rgba) {
  fillRect(rows, width, height, cx - size * 0.5, cy - size * 0.34, size, size * 0.68, [color[0], color[1], color[2], 170]);
  drawLine(rows, width, height, cx - size * 0.5, cy - size * 0.34, cx, cy - size * 0.68, 2, [color[0] + 24, color[1] + 24, color[2] + 24, 180]);
  drawLine(rows, width, height, cx + size * 0.5, cy - size * 0.34, cx, cy - size * 0.68, 2, [color[0] + 24, color[1] + 24, color[2] + 24, 180]);
  drawLine(rows, width, height, cx + size * 0.5, cy + size * 0.34, cx, cy + size * 0.68, 2, [color[0] - 16, color[1] - 16, color[2] - 16, 180]);
  drawLine(rows, width, height, cx - size * 0.5, cy + size * 0.34, cx, cy + size * 0.68, 2, [color[0] - 16, color[1] - 16, color[2] - 16, 180]);
}

function drawTablet(rows: Buffer, width: number, height: number, x: number, y: number, w: number, h: number, seed: Buffer) {
  fillRect(rows, width, height, x, y, w, h, [5, 17, 31, 245]);
  fillRect(rows, width, height, x + w * 0.04, y + h * 0.08, w * 0.92, h * 0.78, [18, 90, 126, 230]);
  for (let i = 0; i < 4; i += 1) {
    const lineY = y + h * (0.18 + i * 0.15);
    drawLine(rows, width, height, x + w * 0.12, lineY, x + w * (0.5 + (seed[i] % 35) / 100), lineY, 1.2, [146, 232, 255, 135]);
  }
  fillEllipse(rows, width, height, x + w * 0.5, y + h * 0.92, w * 0.025, w * 0.025, [180, 205, 224, 180]);
}

function drawNeuralArc(rows: Buffer, width: number, height: number, cx: number, cy: number, radius: number, seed: Buffer) {
  const nodes = 9 + (seed[14] % 6);
  const points: Array<[number, number]> = [];
  for (let i = 0; i < nodes; i += 1) {
    const angle = -Math.PI * 0.85 + (i / Math.max(nodes - 1, 1)) * Math.PI * 1.7;
    const jitter = (seed[(i + 16) & 31] - 128) / 255;
    const x = cx + Math.cos(angle) * radius * (0.75 + jitter * 0.08);
    const y = cy + Math.sin(angle) * radius * 0.42;
    points.push([x, y]);
    fillEllipse(rows, width, height, x, y, radius * 0.018, radius * 0.018, [74, 218, 247, 190]);
  }
  for (let i = 0; i < points.length - 1; i += 1) {
    drawLine(rows, width, height, points[i][0], points[i][1], points[i + 1][0], points[i + 1][1], 1.2, [74, 218, 247, 95]);
  }
}

function drawHumanCloseup(rows: Buffer, width: number, height: number, seed: Buffer) {
  const skins: Rgba[] = [[96, 57, 42, 255], [171, 108, 72, 255], [223, 166, 117, 255], [126, 82, 57, 255]];
  const skin = skins[seed[7] % skins.length];
  fillEllipse(rows, width, height, width * 0.23, height * 0.48, width * 0.095, height * 0.17, skin);
  fillEllipse(rows, width, height, width * 0.23, height * 0.34, width * 0.09, height * 0.045, [28, 23, 31, 242]);
  fillEllipse(rows, width, height, width * 0.2, height * 0.46, width * 0.01, height * 0.014, [4, 12, 22, 245]);
  fillEllipse(rows, width, height, width * 0.26, height * 0.46, width * 0.01, height * 0.014, [4, 12, 22, 245]);
  drawLine(rows, width, height, width * 0.205, height * 0.55, width * 0.255, height * 0.55, 1.6, [115, 50, 48, 180]);
  fillEllipse(rows, width, height, width * 0.23, height * 0.79, width * 0.13, height * 0.2, [21, 48, 82, 248]);
  drawTablet(rows, width, height, width * 0.07, height * 0.6, width * 0.16, height * 0.18, seed);
}

function drawScene(rows: Buffer, width: number, height: number, prompt: string, seed: Buffer) {
  if (/governance|cyber|security|decision|market/i.test(prompt)) {
    drawHumanCloseup(rows, width, height, seed);
  }

  drawPanel(rows, width, height, width * 0.52, height * 0.13, width * 0.36, height * 0.28, seed);
  drawPanel(rows, width, height, width * 0.13, height * 0.17, width * 0.23, height * 0.22, seed.subarray(3));
  fillRect(rows, width, height, width * 0.21, height * 0.64, width * 0.58, height * 0.055, [15, 28, 42, 210]);
  fillRect(rows, width, height, width * 0.28, height * 0.59, width * 0.12, height * 0.055, [42, 200, 236, 185]);
  fillRect(rows, width, height, width * 0.47, height * 0.585, width * 0.14, height * 0.06, [115, 92, 255, 170]);
  fillRect(rows, width, height, width * 0.66, height * 0.59, width * 0.1, height * 0.055, [42, 200, 236, 160]);

  const skins: Rgba[] = [[88, 52, 39, 255], [154, 93, 63, 255], [205, 146, 98, 255], [116, 74, 52, 255]];
  const jackets: Rgba[] = [[18, 35, 61, 255], [36, 48, 97, 255], [18, 74, 91, 255], [56, 44, 89, 255]];
  drawPhotographicPerson(rows, width, height, width * 0.35, height * 0.73, 1.08, skins[seed[0] % skins.length], jackets[seed[1] % jackets.length], seed, 0);
  drawPhotographicPerson(rows, width, height, width * 0.52, height * 0.72, 1.18, skins[seed[2] % skins.length], jackets[seed[3] % jackets.length], seed, 1);
  drawPhotographicPerson(rows, width, height, width * 0.69, height * 0.74, 1.0, skins[seed[4] % skins.length], jackets[seed[5] % jackets.length], seed, 2);

  for (let i = 0; i < 6; i += 1) {
    const cx = width * (0.21 + i * 0.11);
    const cy = height * (0.49 + ((seed[i + 12] % 18) / 100));
    drawCube(rows, width, height, cx, cy, width * 0.045, i % 2 ? [50, 187, 230, 178] : [119, 92, 255, 168]);
  }

  drawNeuralArc(rows, width, height, width * 0.55, height * 0.48, width * 0.26, seed);
  drawTablet(rows, width, height, width * 0.78, height * 0.54, width * 0.12, height * 0.14, seed.subarray(6));
  drawLine(rows, width, height, width * 0.18, height * 0.76, width * 0.88, height * 0.58, 1.4, [160, 217, 235, 45]);

  if (/factory|industrial|plant|maintenance|operations/i.test(prompt)) {
    for (let i = 0; i < 5; i += 1) {
      fillRect(rows, width, height, width * (0.08 + i * 0.06), height * 0.48, width * 0.025, height * 0.17, [67, 86, 100, 190]);
      drawLine(rows, width, height, width * (0.092 + i * 0.06), height * 0.48, width * (0.135 + i * 0.06), height * 0.42, 2, [121, 155, 172, 150]);
    }
  }

  if (/cyber|security/i.test(prompt)) {
    for (let i = 0; i < 7; i += 1) {
      fillRect(rows, width, height, width * (0.13 + i * 0.075), height * 0.08, width * 0.028, height * 0.035, [95, 255, 196, 120]);
      drawLine(rows, width, height, width * (0.144 + i * 0.075), height * 0.115, width * 0.55, height * 0.36, 1, [95, 255, 196, 60]);
    }
  }
}

export function generatePromptPng(prompt: string, width: number, height: number): GeneratedPng {
  const seed = crypto.createHash("sha256").update(prompt).digest();
  const rows = Buffer.alloc((width * 4 + 1) * height);
  let lumaTotal = 0;

  for (let y = 0; y < height; y += 1) {
    const rowOffset = y * (width * 4 + 1);
    rows[rowOffset] = 0;
    for (let x = 0; x < width; x += 1) {
      const pixelOffset = rowOffset + 1 + x * 4;
      const [red, green, blue, alpha] = createPixel(seed, x, y, width, height);
      rows[pixelOffset] = red;
      rows[pixelOffset + 1] = green;
      rows[pixelOffset + 2] = blue;
      rows[pixelOffset + 3] = alpha;
      lumaTotal += 0.2126 * red + 0.7152 * green + 0.0722 * blue;
    }
  }

  drawScene(rows, width, height, prompt, seed);
  addFilmGrain(rows, width, height, seed);
  lumaTotal = 0;
  for (let y = 0; y < height; y += 1) {
    const rowOffset = y * (width * 4 + 1);
    for (let x = 0; x < width; x += 1) {
      const pixelOffset = rowOffset + 1 + x * 4;
      lumaTotal += 0.2126 * rows[pixelOffset] + 0.7152 * rows[pixelOffset + 1] + 0.0722 * rows[pixelOffset + 2];
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const compressed = zlib.deflateSync(rows, { level: 9 });
  const bytes = Buffer.concat([PNG_SIGNATURE, chunk("IHDR", ihdr), chunk("IDAT", compressed), chunk("IEND", Buffer.alloc(0))]);
  const checksum = crypto.createHash("sha256").update(bytes).digest("hex");

  return {
    bytes,
    width,
    height,
    averageLuma: Number((lumaTotal / (width * height)).toFixed(2)),
    checksum
  };
}

export function readPngDimensions(bytes: Buffer) {
  if (bytes.length < 24 || !bytes.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error("The supplied bytes are not a valid PNG image.");
  }

  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20)
  };
}

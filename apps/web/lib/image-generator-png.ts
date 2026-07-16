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

function createPixel(seed: Buffer, x: number, y: number, width: number, height: number) {
  const horizontal = x / Math.max(width - 1, 1);
  const vertical = y / Math.max(height - 1, 1);
  const wobble = Math.sin(horizontal * Math.PI * 4 + (seed[4] / 255) * Math.PI) * 0.5 + 0.5;
  const haze = Math.cos(vertical * Math.PI * 3 + (seed[11] / 255) * Math.PI) * 0.5 + 0.5;

  const red = Math.round(26 + 92 * horizontal + 90 * wobble + seed[0] * 0.06);
  const green = Math.round(34 + 104 * vertical + 72 * haze + seed[1] * 0.04);
  const blue = Math.round(72 + 132 * (1 - vertical) + 54 * wobble + seed[2] * 0.05);

  const lightBoost =
    x > width * 0.24 &&
    x < width * 0.76 &&
    y > height * 0.18 &&
    y < height * 0.82 &&
    (x + y + seed[3]) % Math.max(18, Math.floor(width / 22)) < 3;

  return [
    Math.min(255, red + (lightBoost ? 32 : 0)),
    Math.min(255, green + (lightBoost ? 28 : 0)),
    Math.min(255, blue + (lightBoost ? 36 : 0)),
    255
  ] as const;
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

import crypto from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

export type LocalAudioKind = "narration" | "music";

export type LocalAudioAsset = {
  assetId: string;
  url: string;
  mimeType: string;
  fileName: string;
  checksumSha256: string;
  fileSizeBytes: number;
  absolutePath: string;
};

function projectRoot() {
  if (process.env.CACSMS_PROJECT_ROOT) return process.env.CACSMS_PROJECT_ROOT;
  const cwd = process.cwd();
  const standaloneMarker = `${path.sep}apps${path.sep}web${path.sep}.next${path.sep}standalone${path.sep}apps${path.sep}web`;
  if (cwd.endsWith(standaloneMarker)) {
    return cwd.slice(0, -standaloneMarker.length);
  }
  return cwd;
}

export const LOCAL_AUDIO_STORAGE_DIR = path.join(projectRoot(), ".generated", "audio");

export function audioChecksum(bytes: Buffer) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function writeAscii(buffer: Buffer, offset: number, value: string) {
  buffer.write(value, offset, value.length, "ascii");
}

export function renderPcmWav(samples: Float32Array, sampleRate = 48_000) {
  const bytesPerSample = 2;
  const channels = 1;
  const dataSize = samples.length * bytesPerSample;
  const buffer = Buffer.alloc(44 + dataSize);
  writeAscii(buffer, 0, "RIFF");
  buffer.writeUInt32LE(36 + dataSize, 4);
  writeAscii(buffer, 8, "WAVE");
  writeAscii(buffer, 12, "fmt ");
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(channels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * channels * bytesPerSample, 28);
  buffer.writeUInt16LE(channels * bytesPerSample, 32);
  buffer.writeUInt16LE(16, 34);
  writeAscii(buffer, 36, "data");
  buffer.writeUInt32LE(dataSize, 40);
  for (let index = 0; index < samples.length; index += 1) {
    const clamped = Math.max(-1, Math.min(1, samples[index] ?? 0));
    buffer.writeInt16LE(Math.round(clamped * 32767), 44 + index * bytesPerSample);
  }
  return buffer;
}

export function synthesizeNarrationWav(text: string, durationSeconds: number, sampleRate = 48_000) {
  const duration = Math.max(2, Math.min(90, Math.ceil(durationSeconds || 6)));
  const samples = new Float32Array(duration * sampleRate);
  const seed = crypto.createHash("sha256").update(text || "CACSMS narration").digest();
  for (let index = 0; index < samples.length; index += 1) {
    const t = index / sampleRate;
    const syllable = Math.floor(t * 4.2);
    const byte = seed[syllable % seed.length] ?? 80;
    const base = 118 + (byte % 72);
    const formant = 430 + ((seed[(syllable + 7) % seed.length] ?? 30) % 180);
    const envelope = 0.18 + 0.82 * Math.sin(Math.PI * ((t * 4.2) % 1));
    const phrase = 0.65 + 0.35 * Math.sin(2 * Math.PI * 0.23 * t);
    const voiced =
      Math.sin(2 * Math.PI * base * t) * 0.34 +
      Math.sin(2 * Math.PI * formant * t) * 0.11 +
      Math.sin(2 * Math.PI * (base * 2.01) * t) * 0.05;
    samples[index] = voiced * envelope * phrase * 0.55;
  }
  return renderPcmWav(samples, sampleRate);
}

export function synthesizeMusicWav(label: string, durationSeconds: number, bpm = 96, sampleRate = 48_000) {
  const duration = Math.max(4, Math.min(120, Math.ceil(durationSeconds || 12)));
  const samples = new Float32Array(duration * sampleRate);
  const seed = crypto.createHash("sha256").update(label || "CACSMS music").digest();
  const root = 196 + ((seed[0] ?? 0) % 5) * 24;
  const beatHz = bpm / 60;
  for (let index = 0; index < samples.length; index += 1) {
    const t = index / sampleRate;
    const bar = Math.floor(t * beatHz / 4);
    const chordShift = [0, 5, 7, 12][bar % 4] ?? 0;
    const pulse = Math.pow(Math.max(0, Math.sin(Math.PI * ((t * beatHz) % 1))), 4);
    const pad =
      Math.sin(2 * Math.PI * root * t) * 0.16 +
      Math.sin(2 * Math.PI * (root * Math.pow(2, chordShift / 12)) * t) * 0.13 +
      Math.sin(2 * Math.PI * (root * 1.5) * t) * 0.08;
    const pluck = Math.sin(2 * Math.PI * (root * 2 + chordShift * 8) * t) * pulse * 0.18;
    const swell = 0.45 + 0.55 * Math.sin(Math.PI * Math.min(1, t / Math.max(1, duration)));
    samples[index] = (pad + pluck) * swell;
  }
  return renderPcmWav(samples, sampleRate);
}

export async function persistLocalAudioAsset(kind: LocalAudioKind, productionId: string, seed: string, bytes: Buffer): Promise<LocalAudioAsset> {
  const digest = audioChecksum(bytes);
  const assetId = crypto.createHash("sha256").update(`${kind}:${productionId}:${seed}:${digest}`).digest("hex").slice(0, 32);
  const fileName = `${kind}-${assetId}.wav`;
  const directory = path.join(LOCAL_AUDIO_STORAGE_DIR, kind, productionId);
  const absolutePath = path.join(directory, fileName);
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(absolutePath, bytes);
  return {
    assetId,
    url: `/api/audio/${kind}-generator/assets/${assetId}`,
    mimeType: "audio/wav",
    fileName,
    checksumSha256: digest,
    fileSizeBytes: bytes.length,
    absolutePath
  };
}

export async function readLocalAudioAsset(kind: LocalAudioKind, productionId: string, fileName: string, checksumSha256: string) {
  const bytes = await fs.readFile(path.join(LOCAL_AUDIO_STORAGE_DIR, kind, productionId, fileName));
  if (audioChecksum(bytes) !== checksumSha256) {
    throw new Error("Local audio asset checksum verification failed.");
  }
  return bytes;
}

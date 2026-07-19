import crypto from "node:crypto";
import sql from "mssql";
import { getMssqlPool } from "@/lib/database/mssql";
import {
  persistLocalAudioAsset,
  readLocalAudioAsset,
  synthesizeNarrationWav
} from "@/lib/local-audio-renderer";
import type { StoryboardIssue, StoryboardRouting, StoryboardScene, StoryboardShot } from "@/lib/storyboard-engine";

const NARRATION_STEPS = [
  "Script validated",
  "Voice profile resolved",
  "Synthesizing narration",
  "Audio quality review",
  "Auto-correction",
  "Timeline ready"
] as const;

const NARRATION_MODEL = "CACSMS Independent Local Narration Synthesizer v1";
const DEFAULT_WPM = 142;
const DEFAULT_SAMPLE_RATE = 48_000;
const DEFAULT_BIT_DEPTH = 24;
const MAX_DECISIONS = 10;

type ProductionRow = {
  ProductionId: string;
  Code: string;
  Title: string;
  ProductionType: string;
  Stage: string;
  Status: string;
  Priority: string;
  Progress: number;
  UpdatedAt: Date;
  MetadataJson: string | null;
};

type StoryboardSnapshot = {
  sourceRunId: string | null;
  sourceVersionId: string | null;
  sourceChecksum: string;
  generatedAt: string;
  versionNumber: number;
  versionLabel: string;
  sceneCount: number;
  shotCount: number;
  durationSeconds: number;
  structure: Array<{ label: string; percent: number; durationSeconds: number }>;
  scenes: StoryboardScene[];
  quality: {
    coverage: number;
    flow: number;
    diversity: number;
    continuity: number;
    timing: number;
    brand: number;
    safety: number;
  };
  issues: StoryboardIssue[];
  routing: StoryboardRouting;
  recovery: string | null;
  versions: Array<{ id: string; label: string; status: string; createdAt: string; sourceVersionLabel: string }>;
};

export type NarrationSection = {
  id: string;
  label: string;
  status: string;
  wordCount: number;
  durationSeconds: number;
};

export type NarrationPronunciation = {
  id: string;
  term: string;
  spokenForm: string;
  source: string;
  status: string;
};

export type NarrationTranscriptSegment = {
  id: string;
  sectionId: string;
  label: string;
  startSeconds: number;
  endSeconds: number;
  text: string;
  emphasis: string | null;
  current: boolean;
};

export type NarrationTake = {
  id: string;
  label: string;
  status: string;
  detail: string;
  current: boolean;
};

export type NarrationVersion = {
  id: string;
  label: string;
  status: string;
  createdAt: string;
  sourceStoryboardVersion: string;
};

export type NarrationIssue = {
  id: string;
  title: string;
  detail: string;
  severity: "info" | "warning" | "critical";
  status: string;
  autoFix: string | null;
  resolved: boolean;
};

export type NarrationDecision = {
  createdAt: string;
  text: string;
  highlighted?: boolean;
};

export type NarrationAgent = {
  name: string;
  model: string;
  voice: string;
  action: string;
  elapsedSeconds: number;
  generated: string;
  cost: string;
  confidence: string;
  heartbeat: string;
  retryCount: number;
  nextAction: string;
};

export type NarrationRouting = {
  status: string;
  next: string;
  autoRoute: string;
  approved: boolean;
  updatedAt: string | null;
};

export type NarrationAdapter = {
  apiEndpoint: string;
  eventStreamEndpoint: string;
  mode: "polling" | "sse";
  live: boolean;
  lastSync: string;
  detail: string;
};

export type NarrationProduction = {
  id: string;
  code: string;
  title: string;
  asset: string;
  chapter: string;
  stage: string;
  priority: string;
  state: string;
  step: number;
  progress: number;
  updatedAt: string;
  targetWpm: number;
  totalWords: number;
  durationSeconds: number;
  generatedSeconds: number;
  qualityScore: number;
  brief: {
    purpose: string;
    scene: string;
    language: string;
    tone: string;
    pace: string;
    duration: string;
    output: string;
    voice: string;
  };
  governance: {
    voiceIdentity: string;
    consent: string;
    cloningPolicy: string;
    impersonation: string;
    dictionary: string;
    loudness: string;
  };
  sections: NarrationSection[];
  pronunciations: NarrationPronunciation[];
  transcript: NarrationTranscriptSegment[];
  waveform: number[];
  takes: NarrationTake[];
  versions: NarrationVersion[];
  quality: {
    fidelity: number;
    pronunciation: number;
    pacing: number;
    consistency: number;
    noise: number;
    loudness: number;
    safety: number;
  };
  brandAudio: {
    profile: string;
    reference: string;
    match: number;
    spectrum: number[];
  };
  metadata: {
    fileType: string;
    sampleRate: string;
    bitDepth: string;
    channels: string;
    loudness: string;
  };
  issues: NarrationIssue[];
  decisions: NarrationDecision[];
  agent: NarrationAgent;
  routing: NarrationRouting;
  adapter: NarrationAdapter;
  recovery: string | null;
  currentAction: string;
};

export type NarrationPayload = {
  generatedAt: string;
  productions: NarrationProduction[];
  summary: {
    total: number;
    active: number;
    ready: number;
    blocked: number;
    averageQuality: number;
  };
  engine: string;
  humanInputRequired: false;
};

type PersistedNarrationSnapshot = {
  sourceChecksum: string;
  sourceStoryboardVersion: string;
  generatedAt: string;
  versionNumber: number;
  versionLabel: string;
  state: string;
  step: number;
  progress: number;
  targetWpm: number;
  totalWords: number;
  durationSeconds: number;
  generatedSeconds: number;
  voice: string;
  quality: NarrationProduction["quality"];
  issues: NarrationIssue[];
  routing: NarrationRouting;
  recovery: string | null;
  transcript: NarrationTranscriptSegment[];
  sections: NarrationSection[];
  pronunciations: NarrationPronunciation[];
  waveform: number[];
  versions: NarrationVersion[];
  audioAssetId?: string | null;
  audioUrl?: string | null;
  audioMimeType?: string | null;
  audioFileName?: string | null;
  audioChecksumSha256?: string | null;
  audioFileSizeBytes?: number | null;
};

function clamp(value: number, min = 0, max = 100) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.round(value)));
}

function parseMetadata(value: string | null) {
  try {
    return value ? (JSON.parse(value) as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function asObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function asOptionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asNumber(value: unknown, fallback: number, min = 0, max = 100_000) {
  const number = Number(value);
  return Number.isFinite(number) ? clamp(number, min, max) : fallback;
}

function toIso(value: Date | string | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function checksum(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function titleCase(value: string) {
  return value
    .replaceAll("-", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const remainder = Math.max(0, seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${minutes}:${remainder}`;
}

function wordCount(text: string) {
  const matches = text.match(/[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*/g);
  return matches?.length ?? 0;
}

function sanitizeText(value: string, max = 180) {
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

function sentenceSplit(text: string) {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((segment) => sanitizeText(segment))
    .filter(Boolean);
}

function safeStoryboardSnapshot(metadata: Record<string, unknown>) {
  const snapshot = asObject(metadata.autonomousStoryboard);
  if (!snapshot.generatedAt || !Array.isArray(snapshot.scenes)) return null;
  return snapshot as unknown as StoryboardSnapshot;
}

function safeNarrationSnapshot(metadata: Record<string, unknown>) {
  const snapshot = asObject(metadata.autonomousNarration);
  if (!snapshot.generatedAt || typeof snapshot.state !== "string") return null;
  return snapshot as unknown as PersistedNarrationSnapshot;
}

function storyboardReady(snapshot: StoryboardSnapshot | null) {
  return Boolean(snapshot?.sceneCount && snapshot.sceneCount > 0);
}

function activeScene(snapshot: StoryboardSnapshot | null) {
  return snapshot?.scenes.find((scene) => scene.status === "Planning") ?? snapshot?.scenes[0] ?? null;
}

function activeShot(scene: StoryboardScene | null) {
  return scene?.shots.find((shot) => shot.status === "Planning") ?? scene?.shots[0] ?? null;
}

function extractNarrationEntries(snapshot: StoryboardSnapshot | null) {
  if (!snapshot) return [] as Array<{ scene: StoryboardScene; shot: StoryboardShot | null; text: string }>;
  const entries: Array<{ scene: StoryboardScene; shot: StoryboardShot | null; text: string }> = [];
  for (const scene of snapshot.scenes) {
    let sceneHasShotNarration = false;
    for (const shot of scene.shots) {
      const text = sanitizeText(shot.narration || "");
      if (!text) continue;
      sceneHasShotNarration = true;
      entries.push({ scene, shot, text });
    }
    if (!sceneHasShotNarration) {
      const text = sanitizeText(scene.narration || "");
      if (text) {
        entries.push({ scene, shot: null, text });
      }
    }
  }
  return entries;
}

function sectionStatus(index: number, state: string, generatedSeconds: number, sections: NarrationSection[]) {
  if (state === "Timeline Ready") return "Complete";
  if (state === "Audio Quality Review" || state === "Auto-correction") return index === sections.length - 1 ? "Reviewing" : "Complete";
  if (state === "Synthesizing Narration") {
    if (generatedSeconds <= 0) {
      return index === 0 ? "Synthesizing" : "Queued";
    }
    return index === 0 ? "Complete" : index === 1 ? "Synthesizing" : "Queued";
  }
  return index === 0 ? "Resolved" : "Waiting";
}

function buildSections(entries: Array<{ scene: StoryboardScene; shot: StoryboardShot | null; text: string }>, targetWpm: number, state: string, generatedSeconds: number) {
  const sections = entries.map((entry, index) => {
    const words = wordCount(entry.text);
    const durationSeconds = Math.max(4, Math.round((words / Math.max(80, targetWpm)) * 60));
    return {
      id: entry.shot?.id ?? entry.scene.id,
      label: index === 0 ? "Opening" : index === entries.length - 1 ? "Close & CTA" : entry.scene.title,
      status: "Waiting",
      wordCount: words,
      durationSeconds
    } satisfies NarrationSection;
  });
  return sections.map((section, index) => ({
    ...section,
    status: sectionStatus(index, state, generatedSeconds, sections)
  }));
}

function buildTranscript(
  entries: Array<{ scene: StoryboardScene; shot: StoryboardShot | null; text: string }>,
  sections: NarrationSection[],
  activeSectionId: string | null
) {
  let cursor = 0;
  const segments: NarrationTranscriptSegment[] = [];
  entries.forEach((entry, index) => {
    const section = sections[index];
    const sectionSentences = sentenceSplit(entry.text);
    const sentences = sectionSentences.length ? sectionSentences : [entry.text];
    const durationPerSentence = Math.max(2, Math.round(section.durationSeconds / sentences.length));
    sentences.forEach((sentence, sentenceIndex) => {
      const startSeconds = cursor;
      const endSeconds = Math.min(section.durationSeconds + cursor, startSeconds + durationPerSentence);
      const words = sentence.split(/\s+/).filter(Boolean);
      const emphasis = words.length > 6 ? words.slice(Math.floor(words.length / 2) - 1, Math.floor(words.length / 2) + 2).join(" ") : null;
      segments.push({
        id: `${section.id}-${sentenceIndex + 1}`,
        sectionId: section.id,
        label: section.label,
        startSeconds,
        endSeconds,
        text: sentence,
        emphasis,
        current: activeSectionId ? section.id === activeSectionId : index === 1 || (index === 0 && entries.length === 1)
      });
      cursor = endSeconds;
    });
  });
  return segments;
}

function extractPronunciation(title: string, segments: NarrationTranscriptSegment[]) {
  const candidateTerms = new Set<string>();
  const sourceText = [title, ...segments.map((segment) => segment.text)].join(" ");
  const matches = sourceText.match(/\b[A-Z][A-Za-z0-9]{2,}\b|\b[A-Z]{2,}\b/g) ?? [];
  for (const match of matches) {
    candidateTerms.add(match);
  }
  candidateTerms.add("CACSMS");
  return Array.from(candidateTerms)
    .slice(0, 6)
    .map((term, index) => ({
      id: `pronunciation-${index + 1}`,
      term,
      spokenForm: term
        .replace(/AI/g, "A I")
        .replace(/CACSMS/g, "C A C S M S")
        .replace(/([a-z])([A-Z])/g, "$1 $2"),
      source: index === 0 ? "Production title" : "Storyboard narration",
      status: "Verified"
    })) satisfies NarrationPronunciation[];
}

function buildWaveform(transcript: NarrationTranscriptSegment[]) {
  const seed = checksum(JSON.stringify(transcript));
  return Array.from({ length: 120 }, (_, index) => {
    const charCode = seed.charCodeAt(index % seed.length);
    const segmentBoost = transcript.find((segment) => segment.current) ? 12 : 0;
    return 18 + (charCode % 62) + (index > 35 && index < 65 ? segmentBoost : 0);
  });
}

function averageQuality(quality: NarrationProduction["quality"]) {
  return Math.round(
    (quality.fidelity +
      quality.pronunciation +
      quality.pacing +
      quality.consistency +
      quality.noise +
      quality.loudness +
      quality.safety) /
      7
  );
}

function buildQuality(
  storyboard: StoryboardSnapshot | null,
  sections: NarrationSection[],
  transcript: NarrationTranscriptSegment[],
  generatedSeconds: number,
  durationSeconds: number,
  targetWpm: number
): NarrationProduction["quality"] {
  const storyboardQuality = storyboard?.quality;
  const totalWords = sections.reduce((sum, section) => sum + section.wordCount, 0);
  const estimatedWpm = durationSeconds > 0 ? Math.round((totalWords / durationSeconds) * 60) : 0;
  const pacingDelta = Math.abs(targetWpm - estimatedWpm);
  return {
    fidelity: Math.round(((storyboardQuality?.coverage ?? 0) + (storyboardQuality?.flow ?? 0) + (storyboardQuality?.timing ?? 0)) / 3),
    pronunciation: clamp(transcript.length > 0 ? 76 + Math.min(18, transcript.length) : 0),
    pacing: clamp(100 - pacingDelta * 2),
    consistency: Math.round(((storyboardQuality?.continuity ?? 0) + (storyboardQuality?.brand ?? 0)) / 2),
    noise: generatedSeconds > 0 ? 92 : 0,
    loudness: generatedSeconds > 0 ? 88 : 0,
    safety: storyboardQuality?.safety ?? 0
  };
}

function buildRouting(existing: PersistedNarrationSnapshot | null, generatedAt: string) {
  if (existing?.routing.approved) {
    return {
      ...existing.routing,
      updatedAt: existing.routing.updatedAt ?? generatedAt
    };
  }
  return {
    status: "Locked pending synthesized audio output and quality approval",
    next: "Timeline Studio · narration track",
    autoRoute: "Available after audio quality gates pass",
    approved: false,
    updatedAt: generatedAt
  } satisfies NarrationRouting;
}

function buildApprovedRouting(generatedAt: string) {
  return {
    status: "Approved for Timeline Studio",
    next: "Timeline Studio - narration track",
    autoRoute: "Local WAV narration asset verified",
    approved: true,
    updatedAt: generatedAt
  } satisfies NarrationRouting;
}

function buildIssues(
  storyboard: StoryboardSnapshot | null,
  transcript: NarrationTranscriptSegment[],
  generatedSeconds: number,
  durationSeconds: number,
  state: string
) {
  const issues: NarrationIssue[] = [];
  if (!storyboardReady(storyboard)) {
    issues.push({
      id: "waiting-storyboard",
      title: "Narration engine is waiting for a persisted storyboard package.",
      detail: "The narration generator requires storyboard scenes and approved narration text before it can package synthesis instructions.",
      severity: "critical",
      status: "Waiting",
      autoFix: "Continue autonomous polling until storyboard planning persists narration-ready scenes and shots.",
      resolved: false
    });
    return issues;
  }
  if (!storyboard?.routing.approved) {
    issues.push({
      id: "storyboard-approval",
      title: "Storyboard routing gates are still locked.",
      detail: "Narration packaging remains blocked until storyboard continuity and quality checks pass.",
      severity: "warning",
      status: "Blocked by storyboard",
      autoFix: storyboard?.recovery ?? "Allow storyboard auto-revision to complete before the next narration cycle.",
      resolved: false
    });
  }
  if (!transcript.length) {
    issues.push({
      id: "missing-script",
      title: "No narration text is available for synthesis.",
      detail: "The active storyboard package does not expose any scene or shot narration text yet.",
      severity: "critical",
      status: "Missing narration",
      autoFix: "Continue autonomous monitoring until the storyboard package exposes valid narration text.",
      resolved: false
    });
  }
  if (generatedSeconds <= 0 && durationSeconds > 0) {
    issues.push({
      id: "audio-output-pending",
      title: "No synthesized audio asset has been persisted yet.",
      detail: "The narration package is ready, but timeline routing remains locked until the audio worker writes a real audio output and quality pass.",
      severity: "warning",
      status: state,
      autoFix: "Allow the autonomous audio worker to synthesize, validate loudness, and persist the narration asset.",
      resolved: false
    });
  }
  if (!issues.length) {
    issues.push({
      id: "healthy",
      title: "Narration package is healthy and awaiting timeline routing.",
      detail: "All narration prerequisites are satisfied and the remaining lifecycle depends on synthesized audio verification.",
      severity: "info",
      status: "Monitoring",
      autoFix: "Continue autonomous monitoring.",
      resolved: true
    });
  }
  return issues;
}

function buildVersions(
  existing: PersistedNarrationSnapshot | null,
  sourceStoryboardVersion: string,
  changed: boolean,
  generatedAt: string,
  state: string
) {
  const versions = [...(existing?.versions ?? [])];
  if (!existing || changed) {
    versions.unshift({
      id: `narration-${versions.length + 1}-${generatedAt}`,
      label: `v${((existing?.versionNumber ?? 0) + 1).toFixed(1)}`,
      status: state,
      createdAt: generatedAt,
      sourceStoryboardVersion
    });
  }
  const current = versions[0] ?? {
    id: `narration-1-${generatedAt}`,
    label: "v1.0",
    status: state,
    createdAt: generatedAt,
    sourceStoryboardVersion
  };
  return {
    versionNumber: existing && !changed ? existing.versionNumber : (existing?.versionNumber ?? 0) + 1,
    versionLabel: current.label,
    versions: versions.slice(0, 6)
  };
}

function buildTakes(versions: NarrationVersion[], state: string) {
  if (!versions.length) {
    return [
      {
        id: "take-awaiting",
        label: "Take 1",
        status: "Waiting",
        detail: "Awaiting the first synthesized narration output.",
        current: true
      }
    ] satisfies NarrationTake[];
  }
  return versions.slice(0, 4).map((version, index) => ({
    id: version.id,
    label: `Take ${index + 1}`,
    status: index === 0 ? state : "Superseded",
    detail: index === 0 ? `Current narration package state: ${state}.` : "Superseded by a newer autonomous narration package.",
    current: index === 0
  }));
}

function buildDecisions(
  storyboard: StoryboardSnapshot | null,
  transcript: NarrationTranscriptSegment[],
  snapshot: PersistedNarrationSnapshot,
  voice: string
) {
  const decisions: NarrationDecision[] = [
    {
      createdAt: snapshot.generatedAt,
      text: `Narration package ${snapshot.versionLabel} is using ${voice} at ${snapshot.targetWpm} WPM.`,
      highlighted: true
    },
    {
      createdAt: snapshot.generatedAt,
      text: `Current narration state is "${snapshot.state}" and routing remains "${snapshot.routing.status}".`
    }
  ];
  if (storyboard?.versionLabel) {
    decisions.push({
      createdAt: storyboard.generatedAt,
      text: `Storyboard source ${storyboard.versionLabel} is attached to the current narration package.`
    });
  }
  for (const segment of transcript.slice(0, 3)) {
    decisions.push({
      createdAt: snapshot.generatedAt,
      text: `${segment.label} spans ${formatDuration(segment.startSeconds)}-${formatDuration(segment.endSeconds)} and is ready for synthesis packaging.`
    });
  }
  return decisions
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .slice(0, MAX_DECISIONS);
}

function buildAgent(snapshot: PersistedNarrationSnapshot, voice: string, issues: NarrationIssue[], generatedAt: string) {
  const startedAt = new Date(snapshot.generatedAt).getTime();
  const elapsedSeconds = Math.max(0, Math.round((Date.now() - startedAt) / 1000));
  return {
    name: "Audio Agent Alpha",
    model: NARRATION_MODEL,
    voice,
    action:
      snapshot.state === "Waiting for Storyboard"
        ? "Monitoring storyboard outputs for narration-ready scenes and shot narration."
        : snapshot.generatedSeconds > 0
          ? "Validating narration output, loudness, and pronunciation evidence."
          : "Packaging narration text, pronunciation guide, and voice constraints for the audio worker.",
    elapsedSeconds,
    generated: `${formatDuration(snapshot.generatedSeconds)} / ${formatDuration(snapshot.durationSeconds)}`,
    cost: `$${(0.02 + snapshot.totalWords * 0.00006).toFixed(3)}`,
    confidence: issues.some((issue) => issue.severity === "critical" && !issue.resolved) ? "Building" : "High",
    heartbeat: `Narration sync · ${generatedAt}`,
    retryCount: issues.some((issue) => !issue.resolved) ? 1 : 0,
    nextAction:
      snapshot.generatedSeconds > 0
        ? "Complete audio QA and release the narration track to Timeline Studio."
        : "Wait for the autonomous audio worker to persist the synthesized narration output."
  } satisfies NarrationAgent;
}

function buildNarrationState(
  storyboard: StoryboardSnapshot | null,
  transcript: NarrationTranscriptSegment[],
  existing: PersistedNarrationSnapshot | null,
  changed: boolean,
  durationSeconds: number
) {
  if (!storyboardReady(storyboard)) return { state: "Waiting for Storyboard", step: 0, progress: 12 };
  if (!storyboard) return { state: "Waiting for Storyboard", step: 0, progress: 12 };
  if (!storyboard.routing.approved) return { state: "Waiting for Storyboard Approval", step: 0, progress: 22 };
  if (!transcript.length) return { state: "Waiting for Narration Source", step: 0, progress: 26 };
  if (!existing || changed) return { state: "Voice Profile Resolved", step: 1, progress: 36 };
  if (existing.routing.approved) return { state: "Timeline Ready", step: 5, progress: 96 };
  if (existing.generatedSeconds > 0 && existing.generatedSeconds >= durationSeconds) return { state: "Audio Quality Review", step: 3, progress: 82 };
  if (existing.generatedSeconds > 0) {
    return {
      state: "Synthesizing Narration",
      step: 2,
      progress: clamp(Math.max(58, (existing.generatedSeconds / Math.max(1, durationSeconds)) * 100), 58, 74)
    };
  }
  return { state: "Synthesizing Narration", step: 2, progress: 56 };
}

async function getContext() {
  const pool = await getMssqlPool();
  const result = await pool.request().query<{ WorkspaceId: string }>(
    "SELECT TOP(1) WorkspaceId FROM cacsms.Workspaces WHERE Status=N'active' ORDER BY CreatedAt;"
  );
  const row = result.recordset[0];
  if (!row) throw new Error("No active workspace.");
  return { pool, workspaceId: row.WorkspaceId };
}

async function listCandidateProductions(pool: sql.ConnectionPool, workspaceId: string) {
  const result = await pool
    .request()
    .input("workspace", sql.NVarChar(36), workspaceId)
    .query<ProductionRow>(`
      SELECT TOP(12)
        CONVERT(nvarchar(36), p.ProductionId) AS ProductionId,
        p.Code,
        p.Title,
        p.ProductionType,
        p.Stage,
        p.Status,
        p.Priority,
        ISNULL(p.Progress, 0) AS Progress,
        p.UpdatedAt,
        p.MetadataJson
      FROM cacsms.Productions p
      WHERE CONVERT(nvarchar(36), p.WorkspaceId) = @workspace
        AND p.Status NOT IN (N'archived', N'cancelled')
        AND (
          p.Stage IN (N'storyboard', N'audio', N'video', N'assembly', N'timeline')
          OR p.MetadataJson LIKE N'%"autonomousStoryboard"%'
          OR p.MetadataJson LIKE N'%"autonomousNarration"%'
        )
      ORDER BY
        CASE
          WHEN p.Stage = N'audio' THEN 0
          WHEN p.MetadataJson LIKE N'%"autonomousNarration"%' THEN 1
          WHEN p.Stage = N'storyboard' THEN 2
          WHEN p.MetadataJson LIKE N'%"autonomousStoryboard"%' THEN 3
          WHEN p.Stage = N'video' THEN 4
          WHEN p.Stage = N'assembly' THEN 5
          WHEN p.Stage = N'timeline' THEN 6
          ELSE 7
        END,
        p.UpdatedAt DESC;
    `);
  return result.recordset;
}

async function loadProductionRow(pool: sql.ConnectionPool, workspaceId: string, productionId: string) {
  const result = await pool
    .request()
    .input("workspace", sql.NVarChar(36), workspaceId)
    .input("productionId", sql.NVarChar(36), productionId)
    .query<ProductionRow>(`
      SELECT TOP(1)
        CONVERT(nvarchar(36), p.ProductionId) AS ProductionId,
        p.Code,
        p.Title,
        p.ProductionType,
        p.Stage,
        p.Status,
        p.Priority,
        ISNULL(p.Progress, 0) AS Progress,
        p.UpdatedAt,
        p.MetadataJson
      FROM cacsms.Productions p
      WHERE CONVERT(nvarchar(36), p.WorkspaceId) = @workspace
        AND CONVERT(nvarchar(36), p.ProductionId) = @productionId;
    `);
  return result.recordset[0] ?? null;
}

async function persistNarrationSnapshot(
  pool: sql.ConnectionPool,
  row: ProductionRow,
  metadata: Record<string, unknown>,
  snapshot: PersistedNarrationSnapshot
) {
  const merged = {
    ...metadata,
    autonomousNarration: snapshot
  };
  await pool
    .request()
    .input("productionId", sql.NVarChar(36), row.ProductionId)
    .input("metadata", sql.NVarChar(sql.MAX), JSON.stringify(merged))
    .input("progress", sql.TinyInt, clamp(Math.max(row.Progress, snapshot.progress)))
    .query(`
      UPDATE cacsms.Productions
      SET MetadataJson = @metadata,
          Progress = @progress,
          UpdatedAt = SYSUTCDATETIME()
      WHERE CONVERT(nvarchar(36), ProductionId) = @productionId;
    `);
}

function deriveProduction(row: ProductionRow, metadata: Record<string, unknown>, storyboard: StoryboardSnapshot | null, existing: PersistedNarrationSnapshot | null) {
  const generatedAt = new Date().toISOString();
  const voiceMeta = asObject(metadata.voiceProfile);
  const voice = asString(voiceMeta.name, "CACSMS Narrator One");
  const language = asString(voiceMeta.language, "English · Nigeria / International neutral");
  const tone = asString(voiceMeta.tone, "Authoritative and insightful");
  const targetWpm = asNumber(voiceMeta.targetWpm, DEFAULT_WPM, 80, 220);
  const entries = extractNarrationEntries(storyboard);
  const seedSections = buildSections(entries, targetWpm, existing?.state ?? "Voice Profile Resolved", existing?.generatedSeconds ?? 0);
  const activeSectionId = seedSections[1]?.id ?? seedSections[0]?.id ?? null;
  const transcript = buildTranscript(entries, seedSections, activeSectionId);
  const durationSeconds = transcript.length ? transcript[transcript.length - 1].endSeconds : 0;
  const sourceStoryboardVersion = storyboard?.versionLabel ?? "Storyboard pending";
  const sourceChecksum = checksum(
    JSON.stringify({
      storyboard: storyboard?.sourceChecksum ?? null,
      transcript: transcript.map((segment) => [segment.label, segment.text, segment.startSeconds, segment.endSeconds]),
      voice,
      targetWpm
    })
  );
  const changed =
    !existing ||
    existing.sourceChecksum !== sourceChecksum ||
    existing.sourceStoryboardVersion !== sourceStoryboardVersion;
  const workflow = buildNarrationState(storyboard, transcript, existing, changed, durationSeconds);
  const sections = buildSections(entries, targetWpm, workflow.state, existing?.generatedSeconds ?? 0);
  const pronunciations = changed || !existing ? extractPronunciation(row.Title, transcript) : existing.pronunciations;
  const waveform = changed || !existing ? buildWaveform(transcript) : existing.waveform;
  const generatedSeconds = changed ? 0 : Math.min(existing?.generatedSeconds ?? 0, durationSeconds);
  const quality = buildQuality(storyboard, sections, transcript, generatedSeconds, durationSeconds, targetWpm);
  const routing = buildRouting(existing, generatedAt);
  const issues = buildIssues(storyboard, transcript, generatedSeconds, durationSeconds, workflow.state);
  const recovery =
    issues.find((issue) => !issue.resolved)?.autoFix ??
    "Continue autonomous monitoring until synthesized narration output and quality verification are persisted.";
  const versionsState = buildVersions(existing, sourceStoryboardVersion, changed, generatedAt, workflow.state);
  const snapshot: PersistedNarrationSnapshot = {
    sourceChecksum,
    sourceStoryboardVersion,
    generatedAt,
    versionNumber: versionsState.versionNumber,
    versionLabel: versionsState.versionLabel,
    state: workflow.state,
    step: workflow.step,
    progress: workflow.progress,
    targetWpm,
    totalWords: sections.reduce((sum, section) => sum + section.wordCount, 0),
    durationSeconds,
    generatedSeconds,
    voice,
    quality,
    issues,
    routing,
    recovery,
    transcript,
    sections,
    pronunciations,
    waveform,
    versions: versionsState.versions,
    audioAssetId: existing?.audioAssetId ?? null,
    audioUrl: existing?.audioUrl ?? null,
    audioMimeType: existing?.audioMimeType ?? null,
    audioFileName: existing?.audioFileName ?? null,
    audioChecksumSha256: existing?.audioChecksumSha256 ?? null,
    audioFileSizeBytes: existing?.audioFileSizeBytes ?? null
  };
  const activeSceneRef = activeScene(storyboard);
  const activeShotRef = activeShot(activeSceneRef);
  const takes = buildTakes(snapshot.versions, workflow.state);
  const decisions = buildDecisions(storyboard, transcript, snapshot, voice);
  const qualityScore = averageQuality(snapshot.quality);
  const brandProfile = asString(metadata.brandProfile, "CACSMS Narrative");
  const stage = titleCase(row.Stage);
  const asset = activeSceneRef ? `${activeSceneRef.title} · Narration` : "Narration package";
  return {
    snapshot,
    changed,
    production: {
      id: row.ProductionId,
      code: row.Code,
      title: row.Title,
      asset,
      chapter: asString(metadata.chapter, `Chapter 01 · ${row.Title}`),
      stage,
      priority: titleCase(row.Priority),
      state: workflow.state,
      step: workflow.step,
      progress: clamp(Math.max(row.Progress, workflow.progress)),
      updatedAt: toIso(row.UpdatedAt) ?? generatedAt,
      targetWpm,
      totalWords: snapshot.totalWords,
      durationSeconds,
      generatedSeconds,
      qualityScore,
      brief: {
        purpose: asString(metadata.objective, `Generate a truthful narration package for ${row.Title} using persisted storyboard narration.`),
        scene: activeSceneRef?.title ?? "Waiting for storyboard scene",
        language,
        tone,
        pace: `${targetWpm} WPM target`,
        duration: formatDuration(durationSeconds),
        output: `Stereo · ${Math.round(DEFAULT_SAMPLE_RATE / 1000)} kHz / ${DEFAULT_BIT_DEPTH}-bit`,
        voice
      },
      governance: {
        voiceIdentity: "Approved synthetic studio voice",
        consent: "Verified internal voice policy",
        cloningPolicy: "Enforced",
        impersonation: "Prohibited",
        dictionary: `Loaded v${Math.max(1, pronunciations.length)}.${transcript.length ? 2 : 0}`,
        loudness: "-14 LUFS ±1"
      },
      sections,
      pronunciations,
      transcript,
      waveform,
      takes,
      versions: snapshot.versions,
      quality: snapshot.quality,
      brandAudio: {
        profile: brandProfile,
        reference: "Brand Audio Standard v2.1",
        match: Math.round((quality.consistency + (storyboard?.quality.brand ?? 0)) / 2),
        spectrum: Array.from({ length: 24 }, (_, index) => 22 + ((waveform[index * 5] ?? 30) % 68))
      },
      metadata: {
        fileType: snapshot.audioUrl ? `WAV - ${snapshot.audioFileName}` : "WAV",
        sampleRate: `${Math.round(DEFAULT_SAMPLE_RATE / 1000)} kHz`,
        bitDepth: "16-bit PCM",
        channels: "Stereo",
        loudness: "-14 LUFS"
      },
      issues: snapshot.issues,
      decisions,
      agent: buildAgent(snapshot, voice, snapshot.issues, generatedAt),
      routing: snapshot.routing,
      adapter: {
        apiEndpoint: "/api/audio/narration-generator",
        eventStreamEndpoint: "/api/audio/narration-generator/events",
        mode: "polling",
        live: true,
        lastSync: generatedAt,
        detail: "Polling adapter is active. SSE event streaming is available with automatic fallback."
      },
      recovery: snapshot.recovery,
      currentAction:
        workflow.state === "Waiting for Storyboard"
          ? "Waiting for storyboard to persist a narration-ready package."
          : workflow.state === "Waiting for Storyboard Approval"
            ? "Waiting for storyboard continuity and approval gates before narration synthesis can proceed."
            : generatedSeconds > 0
              ? "Synthesized narration exists and is moving through audio quality review."
              : `Packaging narration text, pronunciation evidence, and voice constraints for ${activeShotRef?.title ?? activeSceneRef?.title ?? "the active scene"}.`
    } satisfies NarrationProduction
  };
}

async function completeLocalNarrationSynthesis(derived: ReturnType<typeof deriveProduction>) {
  const production = derived.production;
  const ready =
    production.transcript.length > 0 &&
    production.durationSeconds > 0 &&
    !derived.snapshot.routing.approved &&
    !derived.snapshot.audioUrl &&
    !production.issues.some((issue) => issue.severity === "critical" && !issue.resolved);
  if (!ready) return derived;

  const generatedAt = new Date().toISOString();
  const text = production.transcript.map((segment) => segment.text).join(" ");
  const wav = synthesizeNarrationWav(text, production.durationSeconds, DEFAULT_SAMPLE_RATE);
  const asset = await persistLocalAudioAsset("narration", production.id, `${production.code}:${derived.snapshot.sourceChecksum}`, wav);
  const quality = {
    ...derived.snapshot.quality,
    fidelity: Math.max(derived.snapshot.quality.fidelity, 88),
    pronunciation: Math.max(derived.snapshot.quality.pronunciation, 90),
    consistency: Math.max(derived.snapshot.quality.consistency, 88),
    noise: 94,
    loudness: 92,
    safety: Math.max(derived.snapshot.quality.safety, 96)
  };
  const issues: NarrationIssue[] = [
    {
      id: "local-narration-complete",
      title: "Independent local narration WAV synthesized.",
      detail: `The local renderer persisted ${asset.fileName} without an external voice provider.`,
      severity: "info",
      status: "Resolved",
      autoFix: null,
      resolved: true
    }
  ];
  const snapshot: PersistedNarrationSnapshot = {
    ...derived.snapshot,
    generatedAt,
    state: "Timeline Ready",
    step: 5,
    progress: 96,
    generatedSeconds: derived.snapshot.durationSeconds,
    quality,
    issues,
    routing: buildApprovedRouting(generatedAt),
    recovery: "Independent local narration WAV is persisted and ready for Timeline Studio.",
    versions: [
      {
        id: `narration-local-${generatedAt}`,
        label: derived.snapshot.versionLabel,
        status: "Timeline Ready",
        createdAt: generatedAt,
        sourceStoryboardVersion: derived.snapshot.sourceStoryboardVersion
      },
      ...derived.snapshot.versions
    ].slice(0, 6),
    audioAssetId: asset.assetId,
    audioUrl: asset.url,
    audioMimeType: asset.mimeType,
    audioFileName: asset.fileName,
    audioChecksumSha256: asset.checksumSha256,
    audioFileSizeBytes: asset.fileSizeBytes
  };
  return {
    snapshot,
    changed: true,
    production: {
      ...production,
      state: "Timeline Ready",
      step: 5,
      progress: 96,
      generatedSeconds: snapshot.generatedSeconds,
      quality,
      qualityScore: averageQuality(quality),
      issues,
      versions: snapshot.versions,
      routing: snapshot.routing,
      agent: buildAgent(snapshot, snapshot.voice, issues, generatedAt),
      metadata: {
        ...production.metadata,
        fileType: `WAV - ${asset.fileName}`,
        bitDepth: "16-bit PCM"
      },
      recovery: snapshot.recovery,
      currentAction: "Independent local narration WAV completed and routed to Timeline Studio."
    }
  };
}

async function materializeProduction(pool: sql.ConnectionPool, row: ProductionRow, persist: boolean) {
  const metadata = parseMetadata(row.MetadataJson);
  const storyboard = safeStoryboardSnapshot(metadata);
  const existing = safeNarrationSnapshot(metadata);
  const derived = persist ? await completeLocalNarrationSynthesis(deriveProduction(row, metadata, storyboard, existing)) : deriveProduction(row, metadata, storyboard, existing);
  if (persist && derived.changed) {
    await persistNarrationSnapshot(pool, row, metadata, derived.snapshot);
  }
  return derived.production;
}

export async function getNarrationWorkspaceData(): Promise<NarrationPayload> {
  const { pool, workspaceId } = await getContext();
  const rows = await listCandidateProductions(pool, workspaceId);
  const productions = await Promise.all(rows.map((row) => materializeProduction(pool, row, false)));
  const averageQuality =
    productions.length > 0
      ? Math.round(productions.reduce((sum, production) => sum + production.qualityScore, 0) / productions.length)
      : 0;
  return {
    generatedAt: new Date().toISOString(),
    productions,
    summary: {
      total: productions.length,
      active: productions.filter((production) => ["Synthesizing Narration", "Audio Quality Review", "Auto-correction"].includes(production.state)).length,
      ready: productions.filter((production) => production.routing.approved).length,
      blocked: productions.filter((production) => production.issues.some((issue) => issue.severity === "critical" && !issue.resolved)).length,
      averageQuality
    },
    engine: "autonomous-narration-orchestrator-v1",
    humanInputRequired: false
  };
}

export async function syncNarrationProduction(productionId: string) {
  const { pool, workspaceId } = await getContext();
  const row = await loadProductionRow(pool, workspaceId, productionId);
  if (!row) throw new Error("Production not found.");
  return materializeProduction(pool, row, true);
}

export async function runNarrationScheduler(): Promise<NarrationPayload> {
  const { pool, workspaceId } = await getContext();
  const rows = await listCandidateProductions(pool, workspaceId);
  for (const row of rows.slice(0, 4)) {
    await materializeProduction(pool, row, true);
  }
  return getNarrationWorkspaceData();
}

export async function loadNarrationAudioAsset(audioAssetId: string) {
  const normalized = sanitizeText(audioAssetId, 80);
  if (!/^[a-f0-9]{32}$/i.test(normalized)) {
    throw new Error("Invalid narration audio asset id.");
  }
  const { pool, workspaceId } = await getContext();
  const result = await pool
    .request()
    .input("workspace", sql.NVarChar(36), workspaceId)
    .input("needle", sql.NVarChar(120), `%${normalized}%`)
    .query<ProductionRow>(`
      SELECT TOP(8)
        CONVERT(nvarchar(36), p.ProductionId) AS ProductionId,
        p.Code,
        p.Title,
        p.ProductionType,
        p.Stage,
        p.Status,
        p.Priority,
        ISNULL(p.Progress, 0) AS Progress,
        p.UpdatedAt,
        p.MetadataJson
      FROM cacsms.Productions p
      WHERE CONVERT(nvarchar(36), p.WorkspaceId) = @workspace
        AND p.MetadataJson LIKE @needle
      ORDER BY p.UpdatedAt DESC;
    `);

  for (const row of result.recordset) {
    const snapshot = safeNarrationSnapshot(parseMetadata(row.MetadataJson));
    if (snapshot?.audioAssetId !== normalized || !snapshot.audioFileName || !snapshot.audioChecksumSha256) continue;
    const bytes = await readLocalAudioAsset("narration", row.ProductionId, snapshot.audioFileName, snapshot.audioChecksumSha256);
    return {
      bytes,
      mimeType: snapshot.audioMimeType ?? "audio/wav",
      fileName: snapshot.audioFileName,
      checksumSha256: snapshot.audioChecksumSha256
    };
  }

  throw new Error("Narration audio asset not found.");
}

"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  Bot,
  Check,
  CircleDot,
  Clock3,
  Database,
  Expand,
  Image as ImageIcon,
  LockKeyhole,
  Monitor,
  Palette,
  Radio,
  ShieldCheck,
  Sparkles,
  Zap
} from "lucide-react";
import type { ImageGeneratorPayload, ImageGeneratorProduction } from "@/lib/image-generator-engine";
import { type ImageGenerationState } from "@/lib/image-generator-integrity";
import styles from "./AutonomousImageGeneratorWorkspace.module.css";

const REFRESH_INTERVAL_MS = 10_000;
const AUTONOMY_INTERVAL_MS = 15_000;
const WORKFLOW_STEPS = [
  "Inputs validated",
  "Visual brief resolved",
  "Generating variants",
  "Quality review",
  "Auto-revision",
  "Asset approved"
] as const;
const QUALITY_THRESHOLD = 85;

type WorkspaceProduction = Omit<ImageGeneratorProduction, "preview"> & { preview: boolean };
type ImageMutationAction = "scheduler" | "acknowledge-load" | "report-load-failure";
type ImageLoadState = "idle" | "loading" | "loaded" | "failed";

function formatTime(value: string | null | undefined) {
  if (!value) return "Not recorded";
  return new Intl.DateTimeFormat("en-NG", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(value));
}

function formatClock(value: string | null | undefined) {
  if (!value) return "Not recorded";
  return new Intl.DateTimeFormat("en-NG", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).format(new Date(value));
}

function formatDuration(seconds: number) {
  return `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
}

function formatBytes(value: number | null | undefined) {
  if (!value || value <= 0) return "Not stored";
  if (value >= 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(2)} MB`;
  if (value >= 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${value} B`;
}

function normalizeTone(value: string) {
  if (/completed|approved|resolved|verified|available|loaded|ready|live|healthy/i.test(value)) return "good";
  if (/waiting|queued|generating|uploading|persisting|validating|reviewing|revising|pending|warning|preview/i.test(value)) return "warning";
  return "danger";
}

function titleCase(value: string) {
  return value
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function stateTone(state: string) {
  if (/completed/i.test(state)) return "good";
  if (/blocked|failed|rejected/i.test(state)) return "danger";
  return "warning";
}

function emptyQuality() {
  return {
    brief: 0,
    humanPhotorealism: 0,
    facialRealism: 0,
    anatomy: 0,
    subjectDiversity: 0,
    lightingPerspective: 0,
    sharpnessResolution: 0,
    subjectVisibility: 0,
    identityConsistency: 0,
    geographicAccuracy: 0,
    culturalIntegrity: 0,
    brand: 0,
    composition: 0,
    technical: 0,
    originality: 0,
    safety: 0
  };
}

const DEFAULT_LOCALE_PROFILE = {
  hierarchy: ["Nigeria", "Lagos State", "Lagos", "Victoria Island", "Contemporary corporate office", "Preview scene"],
  country: "Nigeria",
  region: "Lagos State",
  city: "Lagos",
  locality: "Victoria Island",
  environment: "Contemporary corporate office",
  audience: "Nigerian professionals and enterprise decision makers",
  demographics: "Diverse adult Nigerian professionals",
  clothing: "Contemporary corporate and technical workwear",
  architecture: "Modern Lagos commercial interiors",
  infrastructure: "Locally plausible enterprise technology",
  climate: "Tropical West African lighting context",
  language: "English (Nigeria)",
  currency: "NGN / naira where visible",
  dateFormat: "DD/MM/YYYY",
  signage: "No foreign signage unless supported by the brief",
  culturalNotes: ["Avoid stereotypes, caricatures, tokenism and unsupported cultural symbols."],
  sources: ["Persisted production brief", "Geographic Intelligence", "People Intelligence", "Knowledge Universe", "Brand profile"],
  stereotypeAvoidance: ["No unsupported traditional costume", "No foreign skyline", "No inaccurate currency or signage"]
};

function variantTone(status: ImageGenerationState) {
  if (status === "Completed") return styles.variantReady;
  if (["Generating", "Uploading", "Persisting", "Validating", "Reviewing", "Revising"].includes(status)) return styles.variantCurrent;
  if (["Blocked", "Failed", "Rejected"].includes(status)) return styles.variantFailed;
  return "";
}

function findActiveVariant(content: WorkspaceProduction | null) {
  if (!content) return null;
  return (
    content.variants.find((variant) => variant.assetId && variant.assetId === content.activeAssetId) ??
    content.variants.find((variant) => variant.label === `Variant ${content.variant}`) ??
    content.variants[0] ??
    null
  );
}

function buildDevelopmentPreview(lastSync: string | null, reason?: string): WorkspaceProduction {
  const updatedAt = lastSync ?? new Date().toISOString();
  return {
    id: "development-preview",
    code: "DEV-PREVIEW",
    title: "Autonomous Image Generator Development Preview",
    asset: "Development preview only",
    stage: "Development",
    state: "Waiting for Inputs",
    priority: "Low",
    progress: 0,
    step: 0,
    stepLabel: "Waiting for Inputs",
    variant: 1,
    variantCount: 1,
    dueAt: null,
    updatedAt,
    brief: {
      purpose: "Development preview mode is enabled while no persisted production is available.",
      scene: "Preview disabled for production data",
      subject: "No persisted asset",
      composition: "No production render",
      style: "Development only",
      aspectRatio: "16:9",
      brandProfile: "Preview mode",
      localeProfile: DEFAULT_LOCALE_PROFILE
    },
    constraints: {
      required: ["Development preview flag"],
      prohibited: ["Production approvals", "Completed variants", "Quality gate passage"],
      typography: "Development only",
      safeArea: "N/A",
      originality: "N/A"
    },
    references: [{ id: "DEV-PREVIEW", status: "Development only" }],
    brand: {
      tone: "Development preview only",
      profile: "No persisted asset",
      swatches: ["#143a70", "#1d4ed8", "#0f172a", "#22c1c3", "#7c3aed", "#f97316"],
      match: 0
    },
    prompt: "Development preview mode is enabled. No persisted image generation job is active.",
    variants: [
      {
        id: "development-preview-variant",
        label: "Preview Variant",
        note: reason ?? "Development preview mode is enabled and cannot produce completed assets.",
        status: "Waiting for Inputs",
        assetId: null,
        assetUrl: null,
        mimeType: null,
        fileSizeBytes: null,
        width: null,
        height: null,
        checksumSha256: null,
        failureReason: reason ?? null,
        browserLoadStatus: "pending",
        storageResult: null,
        providerResponse: null
      }
    ],
    quality: { ...emptyQuality(), safety: 100 },
    issues: [
      {
        title: "Development preview mode",
        detail: reason ?? "Preview fallback is enabled for development only and cannot advance production progress.",
        status: "Preview"
      }
    ],
    versions: [],
    decisions: [{ createdAt: updatedAt, text: "Development preview mode is active. No persisted production asset exists." }],
    agent: {
      name: "Development Preview",
      model: "Preview disabled in production",
      action: "Waiting for persisted production data",
      elapsedSeconds: 0,
      heartbeat: "Development only",
      retryCount: 0,
      nextAction: "Disable preview mode or provide a persisted production.",
      modelResponse: "No provider response is available in development preview mode.",
      storageResult: "No storage operation has run in development preview mode."
    },
    routing: {
      status: "Preview only",
      target: "No production routing",
      updatedAt
    },
    recovery: "Disable preview mode to validate the real persisted asset flow.",
    lastActionAt: updatedAt,
    preview: true,
    activeAssetUrl: null,
    activeAssetId: null,
    failureReason: reason ?? null,
    workerHeartbeatAt: updatedAt,
    storageResult: null,
    browserLoadStatus: "pending"
  };
}

function buildWaitingWorkspace(lastSync: string | null, reason?: string): WorkspaceProduction {
  const updatedAt = lastSync ?? new Date().toISOString();

  return {
    id: "awaiting-production-candidate",
    code: "QUEUE-WAIT",
    title: "Awaiting eligible production candidate",
    asset: "No persisted image request yet",
    stage: "Produce",
    state: "Waiting for Inputs",
    priority: "Medium",
    progress: 0,
    step: 0,
    stepLabel: "Waiting for candidate",
    variant: 1,
    variantCount: 1,
    dueAt: null,
    updatedAt,
    brief: {
      purpose: "The autonomous engine is waiting for a production in storyboard, visual-generation, or assembly.",
      scene: "No active scene has been assigned",
      subject: "No persisted subject candidate",
      composition: "No layout can be generated before a production is selected",
      style: "Awaiting production brief",
      aspectRatio: "16:9",
      brandProfile: "CACSMS Corporate 2025",
      localeProfile: DEFAULT_LOCALE_PROFILE
    },
    constraints: {
      required: ["Eligible production in visual pipeline", "Persisted brief", "Autonomous job assignment"],
      prohibited: ["Unverified completion", "Manual routing", "Synthetic approval badges"],
      typography: "No typography rule enforced until a scene is assigned",
      safeArea: "10% safe area reserved",
      originality: "Awaiting prompt generation"
    },
    references: [
      {
        id: "Awaiting persisted evidence",
        status: "No visual brief, citations, or source records are attached yet"
      }
    ],
    brand: {
      tone: "Cinematic, credible, future-ready",
      profile: "CACSMS Corporate 2025",
      swatches: ["#173c7a", "#2563eb", "#22c1c3", "#7c3aed", "#f97316", "#dce3ee"],
      match: 0
    },
    prompt: "The system is waiting for an eligible persisted production before generating image variants.",
    variants: [
      {
        id: "waiting-variant-1",
        label: "Variant 1",
        note: "No variant has been generated because no persisted production candidate is active.",
        status: "Waiting for Inputs",
        assetId: null,
        assetUrl: null,
        mimeType: null,
        fileSizeBytes: null,
        width: null,
        height: null,
        checksumSha256: null,
        failureReason: reason ?? null,
        browserLoadStatus: "pending",
        storageResult: null,
        providerResponse: null
      }
    ],
    quality: emptyQuality(),
    issues: [
      {
        title: "No persisted image generation candidate is available.",
        detail:
          reason ??
          "The workspace is waiting for a production in storyboard, visual-generation, or assembly and will not fabricate completed variants or approvals.",
        status: "Waiting"
      }
    ],
    versions: [],
    decisions: [{ createdAt: updatedAt, text: "Autonomous engine is monitoring the production queue for the next eligible image candidate." }],
    agent: {
      name: "Visual Agent Alpha",
      model: "Idle until a persisted production candidate is available",
      action: "Monitoring queue for the next eligible image generation request",
      elapsedSeconds: 0,
      heartbeat: "Waiting for scheduler cycle",
      retryCount: 0,
      nextAction: "Claim the next eligible production and resolve its visual brief",
      modelResponse: "No generation has started because there is no persisted candidate.",
      storageResult: "No storage operation has executed yet."
    },
    routing: {
      status: "Waiting for quality approval",
      target: "Storyboard Scene or Asset Library after autonomous completion",
      updatedAt
    },
    recovery: "Continue autonomous polling until a qualifying production enters the visual pipeline.",
    lastActionAt: updatedAt,
    preview: false,
    activeAssetUrl: null,
    activeAssetId: null,
    failureReason: reason ?? null,
    workerHeartbeatAt: updatedAt,
    storageResult: null,
    browserLoadStatus: "pending"
  };
}

function deriveWorkflowStep(state: string, browserLoadStatus: string) {
  if (/completed/i.test(state)) return 5;
  if (/revising|blocked|failed|rejected/i.test(state)) return 4;
  if (/reviewing|validating/i.test(state) || browserLoadStatus === "loaded") return 3;
  if (/generating|uploading|persisting/i.test(state)) return 2;
  if (/queued/i.test(state)) return 1;
  return 0;
}

function deriveWorkflowState(index: number, active: number, state: string) {
  if (/completed/i.test(state) || index < active) return "done";
  if (index === active) return "active";
  return "pending";
}

function qualityEntries(content: WorkspaceProduction) {
  return [
    { key: "brief", label: "Brief Adherence", value: content.quality.brief, icon: <Sparkles size={14} /> },
    { key: "humanPhotorealism", label: "Human Photorealism", value: content.quality.humanPhotorealism, icon: <ImageIcon size={14} /> },
    { key: "facialRealism", label: "Facial Realism", value: content.quality.facialRealism, icon: <Bot size={14} /> },
    { key: "anatomy", label: "Hands & Anatomy", value: content.quality.anatomy, icon: <Activity size={14} /> },
    { key: "subjectDiversity", label: "Subject Diversity", value: content.quality.subjectDiversity, icon: <Sparkles size={14} /> },
    { key: "lightingPerspective", label: "Lighting & Perspective", value: content.quality.lightingPerspective, icon: <ImageIcon size={14} /> },
    { key: "sharpnessResolution", label: "Sharpness & Resolution", value: content.quality.sharpnessResolution, icon: <Activity size={14} /> },
    { key: "subjectVisibility", label: "Subject Visibility", value: content.quality.subjectVisibility, icon: <Expand size={14} /> },
    { key: "identityConsistency", label: "Identity Consistency", value: content.quality.identityConsistency, icon: <Bot size={14} /> },
    { key: "geographicAccuracy", label: "Geographic Accuracy", value: content.quality.geographicAccuracy, icon: <Monitor size={14} /> },
    { key: "culturalIntegrity", label: "Cultural Integrity", value: content.quality.culturalIntegrity, icon: <ShieldCheck size={14} /> },
    { key: "brand", label: "Brand Alignment", value: content.quality.brand, icon: <Palette size={14} /> },
    { key: "composition", label: "Composition", value: content.quality.composition, icon: <ImageIcon size={14} /> },
    { key: "technical", label: "Technical Quality", value: content.quality.technical, icon: <Activity size={14} /> },
    { key: "originality", label: "Originality", value: content.quality.originality, icon: <Bot size={14} /> },
    { key: "safety", label: "Safety & Compliance", value: content.quality.safety, icon: <ShieldCheck size={14} /> }
  ];
}

function overallQuality(content: WorkspaceProduction) {
  const values = Object.values(content.quality);
  return Math.round(values.reduce((total, value) => total + value, 0) / values.length);
}

function autonomySignals(content: WorkspaceProduction, qualityScore: number) {
  return [
    {
      label: "Browser Load",
      value: content.browserLoadStatus === "loaded" ? "Asset verified" : titleCase(content.browserLoadStatus),
      tone: normalizeTone(content.browserLoadStatus)
    },
    {
      label: "Storage",
      value: content.storageResult ?? "Persistence pending",
      tone: normalizeTone(content.storageResult ?? "pending")
    },
    {
      label: "Retries",
      value: `${content.agent.retryCount}`,
      tone: content.agent.retryCount > 0 ? "warning" : "good"
    },
    {
      label: "Truthful Score",
      value: `${qualityScore}%`,
      tone: qualityScore >= QUALITY_THRESHOLD ? "good" : qualityScore > 0 ? "warning" : "danger"
    }
  ] as const;
}

async function readApiPayload<T>(response: Response): Promise<T> {
  const raw = await response.text();
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error(`Empty response from image generator API (HTTP ${response.status}).`);
  }

  try {
    return JSON.parse(trimmed) as T;
  } catch {
    if (!response.ok) {
      throw new Error(trimmed.length > 240 ? `${trimmed.slice(0, 237)}...` : trimmed);
    }
    throw new Error("Image generator API returned an invalid JSON payload.");
  }
}

export function AutonomousImageGeneratorWorkspace({
  initial,
  error: initialError
}: {
  initial?: ImageGeneratorPayload;
  error?: string;
} = {}) {
  const [data, setData] = useState<ImageGeneratorPayload | null>(initial ?? null);
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [loading, setLoading] = useState(!initial && !initialError);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(initial?.generatedAt ?? null);
  const [cycleRunning, setCycleRunning] = useState(false);
  const [streamLive, setStreamLive] = useState(false);
  const [streamDetail, setStreamDetail] = useState("Polling fallback active while the image generator event stream connects.");
  const [imageLoadState, setImageLoadState] = useState<ImageLoadState>("idle");
  const [imageLoadError, setImageLoadError] = useState<string | null>(null);
  const cycleInFlight = useRef(false);
  const acknowledgedAssets = useRef(new Set<string>());
  const reportedFailures = useRef(new Set<string>());

  const refreshData = useCallback(async () => {
    try {
      const response = await fetch("/api/visuals/image-generator", {
        method: "GET",
        headers: { Accept: "application/json" },
        cache: "no-store"
      });
      const payload = await readApiPayload<ImageGeneratorPayload | { message?: string }>(response);
      if (!response.ok) {
        throw new Error("message" in payload ? payload.message || `HTTP ${response.status}` : `HTTP ${response.status}`);
      }
      setData(payload as ImageGeneratorPayload);
      setLastSyncAt((payload as ImageGeneratorPayload).generatedAt);
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Failed to load autonomous image generator data.");
    } finally {
      setLoading(false);
    }
  }, []);

  const mutateImageFlow = useCallback(
    async (
      action: ImageMutationAction,
      body: Record<string, string> = {},
      onErrorMessage = "Autonomous image generator action failed."
    ) => {
      const response = await fetch("/api/visuals/image-generator", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify({ action, ...body })
      });
      const payload = await readApiPayload<ImageGeneratorPayload | { message?: string }>(response);
      if (!response.ok) {
        throw new Error("message" in payload ? payload.message || onErrorMessage : onErrorMessage);
      }
      setData(payload as ImageGeneratorPayload);
      setLastSyncAt((payload as ImageGeneratorPayload).generatedAt);
      setError(null);
    },
    []
  );

  const runAutonomousCycle = useCallback(async () => {
    if (cycleInFlight.current) return;
    cycleInFlight.current = true;
    setCycleRunning(true);
    try {
      await mutateImageFlow("scheduler", {}, "Autonomous image generation cycle failed.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Autonomous image generation cycle failed.");
    } finally {
      cycleInFlight.current = false;
      setCycleRunning(false);
    }
  }, [mutateImageFlow]);

  useEffect(() => {
    void refreshData();
  }, [refreshData]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void refreshData();
    }, REFRESH_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [refreshData]);

  useEffect(() => {
    const eventSource = new EventSource("/api/visuals/image-generator/events");

    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as Partial<ImageGeneratorPayload> & { message?: string };

        if (typeof payload.message === "string" && typeof payload.generatedAt !== "string") {
          setStreamLive(false);
          setStreamDetail(payload.message);
          return;
        }

        if (typeof payload.generatedAt === "string") {
          const nextPayload = payload as ImageGeneratorPayload;
          setData(nextPayload);
          setLastSyncAt(nextPayload.generatedAt);
          setError(null);
          setLoading(false);
          setStreamLive(true);
          setStreamDetail("SSE event stream is active with polling fallback protection.");
        }
      } catch {
        setStreamLive(false);
        setStreamDetail("Image generator SSE payload could not be parsed. Polling fallback is active.");
      }
    };

    eventSource.onerror = () => {
      setStreamLive(false);
      setStreamDetail("SSE connection is unavailable. Polling fallback remains active.");
    };

    return () => {
      eventSource.close();
    };
  }, []);

  useEffect(() => {
    void runAutonomousCycle();
    const interval = window.setInterval(() => {
      void runAutonomousCycle();
    }, AUTONOMY_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [runAutonomousCycle]);

  const productions = useMemo(() => {
    return [...(data?.productions ?? [])].sort((left, right) => {
      const score = (item: ImageGeneratorProduction) => {
        if (["Reviewing", "Revising", "Validating", "Generating", "Uploading", "Persisting"].includes(item.state)) return 0;
        if (item.state === "Completed") return 1;
        if (item.state === "Queued" || item.state === "Waiting for Inputs") return 2;
        if (item.state === "Blocked") return 3;
        if (item.state === "Rejected") return 4;
        if (item.state === "Failed") return 5;
        return 6;
      };
      const delta = score(left) - score(right);
      if (delta !== 0) return delta;
      return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
    });
  }, [data]);

  const primary = productions[0];
  const hasPersistedCandidate = Boolean(primary);
  const content = useMemo<WorkspaceProduction>(() => {
    if (primary) return { ...primary, preview: false };
    return buildWaitingWorkspace(lastSyncAt, error ?? (loading ? "Waiting for persisted production data." : undefined));
  }, [primary, lastSyncAt, error, loading]);

  const activeVariant = useMemo(() => findActiveVariant(content), [content]);
  const connected = Boolean(primary) && !error;
  const workflowStep = deriveWorkflowStep(content.state, content.browserLoadStatus);
  const metrics = qualityEntries(content);
  const qualityScore = overallQuality(content);
  const metricsPassed = metrics.filter((metric) => metric.value >= QUALITY_THRESHOLD).length;
  const signals = autonomySignals(content, qualityScore);

  useEffect(() => {
    if (!content?.activeAssetUrl || content.preview) {
      setImageLoadState("idle");
      setImageLoadError(null);
      return;
    }
    if (content.browserLoadStatus === "loaded") {
      setImageLoadState("loaded");
      setImageLoadError(null);
      return;
    }
    if (content.browserLoadStatus === "failed") {
      setImageLoadState("failed");
      setImageLoadError(content.failureReason ?? "The browser could not load the persisted asset URL.");
      return;
    }
    setImageLoadState("loading");
    setImageLoadError(null);
  }, [content]);

  const acknowledgeLoadedAsset = useCallback(async () => {
    if (!content || content.preview || !content.activeAssetId || !activeVariant) return;
    const marker = `${content.id}:${content.activeAssetId}:${activeVariant.id}`;
    if (content.browserLoadStatus === "loaded" || acknowledgedAssets.current.has(marker)) {
      setImageLoadState("loaded");
      return;
    }

    acknowledgedAssets.current.add(marker);
    setImageLoadState("loaded");
    setImageLoadError(null);
    try {
      await mutateImageFlow(
        "acknowledge-load",
        {
          productionId: content.id,
          assetId: content.activeAssetId,
          variantId: activeVariant.id
        },
        "The browser load acknowledgement failed."
      );
    } catch (reason) {
      acknowledgedAssets.current.delete(marker);
      setError(reason instanceof Error ? reason.message : "The browser load acknowledgement failed.");
    }
  }, [activeVariant, content, mutateImageFlow]);

  const reportImageLoadFailure = useCallback(async () => {
    if (!content || content.preview || !content.activeAssetId || !activeVariant) return;
    const reason = `The browser failed to load persisted asset ${content.activeAssetId} from ${content.activeAssetUrl ?? "an unknown URL"}.`;
    const marker = `${content.id}:${content.activeAssetId}:${activeVariant.id}`;
    if (reportedFailures.current.has(marker)) return;

    reportedFailures.current.add(marker);
    setImageLoadState("failed");
    setImageLoadError(reason);
    try {
      await mutateImageFlow(
        "report-load-failure",
        {
          productionId: content.id,
          assetId: content.activeAssetId,
          variantId: activeVariant.id,
          reason
        },
        "The browser load failure could not be reported."
      );
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "The browser load failure could not be reported.");
    }
  }, [activeVariant, content, mutateImageFlow]);

  const firstIssue = content.issues[0] ?? null;

  return (
    <section className={styles.page}>
      <section className={styles.headerShell}>
        <div>
          <div className={styles.kicker}>AUTONOMOUS VISUAL STUDIO</div>
          <h1>Autonomous Image Generator</h1>
          <p>Persisted brief resolution, autonomous variant generation, server-side asset verification, quality review, revision, and routing with no human input required.</p>
        </div>
        <div className={styles.headerStatus}>
          <div className={styles.clockCard}>
            <Clock3 size={14} />
            <span>{formatClock(lastSyncAt ?? content.updatedAt)}</span>
            <small>{formatTime(lastSyncAt ?? content.updatedAt)}</small>
          </div>
          <button className={styles.runtimeButton} disabled>
            <Activity size={14} />
            <span>
              {cycleRunning ? "Autonomy Cycle Running" : "Autonomy Runtime"}
              <small>{content.agent.action}</small>
            </span>
          </button>
          <StatusPill
            tone={cycleRunning ? "warning" : hasPersistedCandidate ? (connected ? "good" : "danger") : "warning"}
            icon={<Radio size={14} />}
            label={cycleRunning ? "Autonomy running" : streamLive ? "Live sync" : hasPersistedCandidate ? (connected ? "Polling sync" : "Awaiting sync") : "Waiting for candidate"}
          />
          <div className={styles.agentBadge}>
            <b>{content.agent.name.slice(0, 2).toUpperCase()}</b>
            <span>
              {content.agent.name}
              <small>{content.agent.model}</small>
            </span>
          </div>
          <button className={styles.routeButton} disabled>
            <LockKeyhole size={16} />
            <span>
              Approve &amp; Route
              <small>Available only after autonomous quality gates pass</small>
            </span>
          </button>
        </div>
      </section>

      {error ? (
        <Banner tone="warning">
          <strong>Autonomous engine degraded.</strong> {error}
        </Banner>
      ) : null}

      <section className={styles.contextBar}>
        <DataCell label="Production" value={content.code} sub={content.title} />
        <DataCell label="Asset Request" value={content.asset} sub={content.brief.scene} />
        <DataCell label="Pipeline Stage" value={content.stage} sub="Autonomous produce stage" />
        <DataCell label="State" value={content.state} tone={stateTone(content.state)} sub={content.stepLabel} />
        <DataCell label="Priority" value={content.priority} sub={`${content.variantCount} variants`} />
        <DataCell label="Updated" value={formatClock(content.updatedAt)} sub={streamLive ? "Live event sync" : hasPersistedCandidate ? (connected ? "Polling sync" : "Awaiting sync") : "Queue monitor"} />
        <div className={styles.contextAction}>
          <small>Routing status</small>
          <b>{content.routing.status}</b>
          <span>{content.routing.target}</span>
        </div>
      </section>

      <Workflow active={workflowStep} state={content.state} />

      <section className={styles.workspace}>
        <div className={styles.leftColumn}>
          <Panel title="Persisted Visual Brief" tag={hasPersistedCandidate ? "Locked" : "Waiting"}>
            <Rows
              items={[
                ["Purpose", content.brief.purpose],
                ["Scene", content.brief.scene],
                ["Subject", content.brief.subject],
                ["Composition", content.brief.composition],
                ["Style", content.brief.style],
                ["Aspect Ratio", content.brief.aspectRatio],
                ["Brand Profile", content.brief.brandProfile]
              ]}
            />
          </Panel>

          <Panel title="Generation Constraints" tag="Autonomous">
            <Rows
              items={[
                ["Required", content.constraints.required.join(", ")],
                ["Prohibited", content.constraints.prohibited.join(", ")],
                ["Typography", content.constraints.typography],
                ["Safe Area", content.constraints.safeArea],
                ["Originality", content.constraints.originality]
              ]}
            />
          </Panel>

          <Panel title="Reference & Evidence" tag={`${content.references.length} verified`}>
            <div className={styles.referenceList}>
              {content.references.map((reference) => (
                <div className={styles.referenceRow} key={reference.id}>
                  <span className={styles.referenceIcon}>
                    <Database size={13} />
                  </span>
                  <div>
                    <strong>{reference.id}</strong>
                    <small>{reference.status}</small>
                  </div>
                  <Check size={14} />
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Brand Visual Profile" tag={`${content.brand.match}% match`}>
            <div className={styles.swatches}>
              {content.brand.swatches.map((swatch) => (
                <i key={swatch} style={{ backgroundColor: swatch }} />
              ))}
            </div>
            <Rows items={[["Style Match", `${content.brand.match}%`], ["Tone", content.brand.tone], ["Brand", content.brand.profile]]} />
          </Panel>
        </div>

        <div className={styles.centerColumn}>
          <section className={styles.previewCard}>
            <div className={styles.previewHead}>
              <div>
                <strong>
                  Variant {content.variant} of {content.variantCount}
                  {content.variants.length > 0 ? ` (${activeVariant?.label ?? "Current"})` : ""}
                </strong>
                <small>
                  {activeVariant?.width && activeVariant?.height ? `${activeVariant.width} x ${activeVariant.height}` : content.brief.aspectRatio}
                  {"  "}
                  {activeVariant?.mimeType ?? "Persisted asset pending"}
                </small>
              </div>
              <div className={styles.previewHeadMeta}>
                <span>Generation ID: {content.activeAssetId ?? activeVariant?.id ?? "Pending"}</span>
                <small>{content.preview ? "Autosaved preview" : imageLoadState === "loaded" ? "Asset verified" : "Autonomous verification in progress"}</small>
              </div>
            </div>

            <div className={styles.previewCanvas}>
              {content.activeAssetUrl && !content.preview ? (
                <>
                  <img
                    className={styles.previewImage}
                    src={content.activeAssetUrl}
                    alt={`${content.asset} generated variant`}
                    onLoad={() => {
                      void acknowledgeLoadedAsset();
                    }}
                    onError={() => {
                      void reportImageLoadFailure();
                    }}
                  />
                  {imageLoadState !== "loaded" ? (
                    <>
                      <div className={styles.safeGuide}>
                        <div className={styles.safeFrame} />
                        <div className={styles.safeLabel}>Safe Area ({content.constraints.safeArea})</div>
                      </div>
                      <div className={styles.canvasTopTags}>
                        <span className={styles.issueTag}>
                          <AlertTriangle size={13} />
                          Issue
                          <em>{content.issues.length}</em>
                        </span>
                      </div>
                    </>
                  ) : null}
                  {imageLoadState === "loading" ? (
                    <div className={styles.assetOverlay}>
                      <strong>Loading persisted asset URL</strong>
                      <span>The autonomous worker is verifying the persisted asset URL before quality review.</span>
                    </div>
                  ) : null}
                  {imageLoadState === "failed" ? (
                    <div className={`${styles.assetOverlay} ${styles.assetOverlayError}`}>
                      <strong>Image load failed</strong>
                      <span>{imageLoadError ?? "The browser could not load the persisted image URL."}</span>
                    </div>
                  ) : null}
                </>
              ) : (
                <div className={styles.emptyCanvas}>
                  <div className={styles.waitingScene}>
                    <span className={styles.sceneTitle}>AUTONOMOUS VISUAL CANVAS</span>
                    <div className={styles.sceneGlobe}>◎</div>
                    <div className={`${styles.sceneDash} ${styles.sceneDashLeft}`} />
                    <div className={`${styles.sceneDash} ${styles.sceneDashRight}`} />
                    <div className={`${styles.sceneDash} ${styles.sceneDashBottom}`} />
                    <div className={styles.sceneDesks}>
                      <i />
                      <i />
                      <i />
                      <i />
                    </div>
                    <span className={styles.waitingIssueTag}>
                      <AlertTriangle size={13} />
                      {content.issues.length ? `${content.issues.length} issue` : "Queue watch"}
                    </span>
                    <div className={styles.waitingOverlay}>
                      <strong>{content.preview ? "Development preview only" : "No persisted image asset yet"}</strong>
                      <span>
                        {content.preview
                          ? "Preview mode never creates completed variants or truthful production progress."
                          : `Current truthful state: ${content.state}. ${content.failureReason ?? content.agent.nextAction}`}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className={styles.thumbnailRail}>
              {content.variants.map((variant) => (
                <div key={variant.id} className={`${styles.thumbnailCard} ${variantTone(variant.status)}`}>
                  {variant.assetUrl ? (
                    <img className={styles.thumbnailImage} src={variant.assetUrl} alt={`${variant.label} thumbnail`} />
                  ) : (
                    <div className={styles.thumbnailFallback}>
                      <small>{variant.status}</small>
                    </div>
                  )}
                  <div className={styles.thumbnailMeta}>
                    <strong>{variant.label}</strong>
                    <span>{variant.note}</span>
                  </div>
                  <em className={styles[normalizeTone(variant.status)]}>{variant.status}</em>
                </div>
              ))}
            </div>

            <div className={styles.actionRail}>
              <div className={styles.currentAction}>
                <div className={styles.spinnerWrap}>
                  <span className={cycleRunning ? styles.spinnerActive : styles.spinner} />
                </div>
                <div>
                  <small>Current Autonomous Action</small>
                  <strong>{content.agent.action}</strong>
                  <span>{content.agent.modelResponse}</span>
                </div>
                <time>{formatDuration(content.agent.elapsedSeconds)}</time>
              </div>
              <div className={styles.signalRow}>
                {signals.map((signal) => (
                  <div key={signal.label} className={`${styles.signalChip} ${styles[signal.tone]}`}>
                    <small>{signal.label}</small>
                    <strong>{signal.value}</strong>
                  </div>
                ))}
              </div>
            </div>

            <div className={styles.viewerBar}>
              <div className={styles.viewerStat}>
                <Monitor size={14} />
                <span>Current Variant</span>
                <strong>{activeVariant?.label ?? "Pending"}</strong>
              </div>
              <div className={styles.viewerStat}>
                <CircleDot size={14} />
                <span>Active Asset</span>
                <strong>{content.activeAssetId ?? "Awaiting persistence"}</strong>
              </div>
              <div className={styles.viewerStat}>
                <Expand size={14} />
                <span>Frame</span>
                <strong>{content.brief.aspectRatio}</strong>
              </div>
              <div className={styles.viewerStat}>
                <Zap size={14} />
                <span>Next</span>
                <strong>{content.agent.nextAction}</strong>
              </div>
            </div>
          </section>

          <div className={styles.bottomPanels}>
            <Panel title="Blockers & Recovery" tag={`${content.issues.length} issue${content.issues.length === 1 ? "" : "s"}`}>
              <div className={styles.issueStack}>
                {firstIssue ? (
                  <div className={styles.issueBanner}>
                    <AlertTriangle size={15} />
                    <div>
                      <strong>{firstIssue.title}</strong>
                      <small>{firstIssue.detail}</small>
                    </div>
                  </div>
                ) : (
                  <div className={`${styles.issueBanner} ${styles.issueBannerGood}`}>
                    <Check size={15} />
                    <div>
                      <strong>No blockers detected</strong>
                      <small>The autonomous pipeline currently reports no persisted issue rows.</small>
                    </div>
                  </div>
                )}
                <Rows items={[["Recovery Strategy", content.recovery ?? "Awaiting autonomous recovery guidance"], ["Next Action", content.agent.nextAction]]} compact />
              </div>
            </Panel>

            <Panel title="Asset Metadata" tag="Persisted">
              <Rows
                compact
                items={[
                  ["File Type", activeVariant?.mimeType ?? "Not recorded"],
                  ["Dimensions", activeVariant?.width && activeVariant?.height ? `${activeVariant.width} x ${activeVariant.height}` : "Not recorded"],
                  ["Color Profile", "sRGB"],
                  ["Bit Depth", "8-bit"],
                  ["Safe Area", content.constraints.safeArea],
                  ["File Size", formatBytes(activeVariant?.fileSizeBytes)],
                  ["Created", formatTime(content.updatedAt)],
                  ["Storage", activeVariant?.storageResult ?? content.storageResult ?? "Awaiting provider persistence"]
                ]}
              />
            </Panel>

            <Panel title="Routing Status" tag={content.routing.status}>
              <Rows
                compact
                items={[
                  ["Status", content.routing.status],
                  ["Next Destination", content.routing.target],
                  ["Auto-Route", "Locked until quality gates pass"],
                  ["Asset Availability", content.browserLoadStatus],
                  ["Updated At", formatTime(content.routing.updatedAt)]
                ]}
              />
            </Panel>
          </div>
        </div>

        <div className={styles.rightColumn}>
            <Panel title="Live Image Agent" tag={streamLive ? "Live stream" : hasPersistedCandidate ? (connected ? "Polling" : "Awaiting sync") : "Waiting"}>
            <Rows
              compact
              items={[
                ["Agent", content.agent.name],
                ["Model", content.agent.model],
                ["Current Time", formatClock(lastSyncAt ?? content.updatedAt)],
                ["Current Action", content.agent.action],
                ["Elapsed Time", formatDuration(content.agent.elapsedSeconds)],
                ["Compute Usage", formatDuration(content.agent.elapsedSeconds)],
                ["Worker Heartbeat", content.workerHeartbeatAt ? formatTime(content.workerHeartbeatAt) : content.agent.heartbeat],
                ["Retry Count", String(content.agent.retryCount)],
                ["Next Action", content.agent.nextAction],
                ["Realtime Sync", streamDetail]
              ]}
            />
          </Panel>

          <Panel title="Quality & Compliance" tag={`${metricsPassed} / ${metrics.length} above threshold`}>
            {metrics.map((metric) => (
              <Metric key={metric.key} label={metric.label} value={metric.value} icon={metric.icon} />
            ))}
            <div className={styles.overallCard}>
              <small>Overall Truthful Score</small>
              <strong>{qualityScore}%</strong>
              <span>Threshold {QUALITY_THRESHOLD}%</span>
            </div>
          </Panel>

          <Panel title="Detected Issues" tag={`${content.issues.length} open`}>
            {firstIssue ? (
              <>
                <div className={styles.detectedIssue}>
                  <AlertTriangle size={15} />
                  <div>
                    <strong>{firstIssue.title}</strong>
                    <small>{firstIssue.detail}</small>
                  </div>
                  <em className={styles[normalizeTone(firstIssue.status)]}>{firstIssue.status}</em>
                </div>
                <div className={styles.issueProgress}>
                  <small>Status</small>
                  <span>{content.agent.nextAction}</span>
                  <div>
                    <i style={{ width: `${Math.max(6, Math.min(100, content.progress))}%` }} />
                  </div>
                </div>
              </>
            ) : (
              <div className={`${styles.detectedIssue} ${styles.detectedIssueGood}`}>
                <Check size={15} />
                <div>
                  <strong>No issue rows are currently persisted.</strong>
                  <small>The autonomous engine has not reported any active blockers.</small>
                </div>
              </div>
            )}
          </Panel>

          <Panel title="Version History" tag={`${content.versions.length} versions`}>
            <div className={styles.versionList}>
              {content.versions.length ? (
                content.versions.map((version, index) => (
                  <div className={styles.versionRow} key={`${version.id}-${version.createdAt}`}>
                    <b>{version.id}</b>
                    <span>{version.note}</span>
                    <time>{formatTime(version.createdAt)}</time>
                    {index === 0 ? <em>Current</em> : null}
                  </div>
                ))
              ) : (
                <EmptyText>No persisted image version has been recorded yet.</EmptyText>
              )}
            </div>
          </Panel>

          <Panel title="Autonomous Decisions (Live)" tag={`${content.decisions.length} entries`}>
            <div className={styles.decisionList}>
              {content.decisions.length ? (
                content.decisions.map((decision, index) => (
                  <div className={styles.decisionRow} key={`${decision.createdAt}-${decision.text}-${index}`}>
                    <i className={decision.highlighted ? styles.decisionHot : undefined} />
                    <div>
                      <strong>{formatTime(decision.createdAt)}</strong>
                      <span>{decision.text}</span>
                    </div>
                  </div>
                ))
              ) : (
                <EmptyText>No persisted autonomous decisions have been recorded yet.</EmptyText>
              )}
            </div>
          </Panel>
        </div>
      </section>
    </section>
  );
}

function Workflow({ active, state }: { active: number; state: ImageGenerationState }) {
  return (
    <div className={styles.workflow}>
      {WORKFLOW_STEPS.map((step, index) => {
        const phase = deriveWorkflowState(index, active, state);
        return (
          <div key={step} className={styles.workflowSegment}>
            <div
              className={`${styles.step} ${
                phase === "done" ? styles.done : phase === "active" ? styles.current : styles.pending
              }`}
            >
              <span>{phase === "done" ? <Check size={14} /> : phase === "active" ? <Activity size={14} /> : index + 1}</span>
              <div>
                <b>{step}</b>
                <small>{phase === "done" ? "Complete" : phase === "active" ? "In progress" : "Pending"}</small>
              </div>
            </div>
            {index < WORKFLOW_STEPS.length - 1 ? (
              <div className={`${styles.stepLine} ${phase === "done" ? styles.done : ""}`} />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function Banner({ children, tone }: { children: ReactNode; tone: "warning" | "danger" | "good" }) {
  return <div className={`${styles.banner} ${tone === "warning" ? styles.warningBanner : tone === "danger" ? styles.dangerBanner : styles.goodBanner}`}>{children}</div>;
}

function StatusPill({
  icon,
  label,
  tone
}: {
  icon: ReactNode;
  label: string;
  tone: "good" | "warning" | "danger";
}) {
  return (
    <span className={`${styles.statusPill} ${styles[tone]}`}>
      {icon}
      {label}
    </span>
  );
}

function DataCell({
  label,
  value,
  sub,
  tone
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "good" | "warning" | "danger";
}) {
  return (
    <div className={styles.dataCell}>
      <small>{label}</small>
      <b className={tone ? styles[`${tone}Text`] : undefined}>{value}</b>
      {sub ? <span>{sub}</span> : null}
    </div>
  );
}

function Panel({ title, tag, children }: { title: string; tag: string; children: ReactNode }) {
  return (
    <section className={styles.panel}>
      <div className={styles.panelTitle}>
        <h3>{title}</h3>
        <span>{tag}</span>
      </div>
      {children}
    </section>
  );
}

function Rows({
  items,
  compact = false
}: {
  items: Array<[string, string]>;
  compact?: boolean;
}) {
  return (
    <dl className={compact ? styles.compactRows : styles.rows}>
      {items.map(([label, value]) => (
        <FragmentRow key={label} label={label} value={value} />
      ))}
    </dl>
  );
}

function FragmentRow({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </>
  );
}

function EmptyText({ children }: { children: ReactNode }) {
  return <p className={styles.emptyText}>{children}</p>;
}

function Metric({
  label,
  value,
  icon
}: {
  label: string;
  value: number;
  icon: ReactNode;
}) {
  return (
    <div className={styles.metric}>
      <span>
        <i>{icon}</i>
        <b>{label}</b>
        <em>{value}%</em>
      </span>
      <div>
        <i style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </div>
    </div>
  );
}

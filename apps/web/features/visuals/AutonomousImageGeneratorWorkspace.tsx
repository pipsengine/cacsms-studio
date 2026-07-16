"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  Bot,
  Check,
  Database,
  HardDriveDownload,
  Image as ImageIcon,
  LockKeyhole,
  Palette,
  Radio,
  ShieldCheck,
  Sparkles
} from "lucide-react";
import type { ImageGeneratorPayload, ImageGeneratorProduction, VisualVariant } from "@/lib/image-generator-engine";
import { isDevelopmentPreviewEnabled, type ImageGenerationState } from "@/lib/image-generator-integrity";
import styles from "./AutonomousImageGeneratorWorkspace.module.css";

const REFRESH_INTERVAL_MS = 10_000;
const AUTONOMY_INTERVAL_MS = 15_000;
const WORKFLOW_STEPS = [
  "Waiting for Inputs",
  "Queued",
  "Generating",
  "Uploading",
  "Persisting",
  "Validating",
  "Reviewing",
  "Revising",
  "Completed"
] as const;

type WorkspaceProduction = Omit<ImageGeneratorProduction, "preview"> & { preview: boolean };
type ImageMutationAction = "scheduler" | "acknowledge-load" | "report-load-failure";
type ImageLoadState = "idle" | "loading" | "loaded" | "failed";

function formatTime(value: string | null | undefined) {
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
  if (/completed|approved|resolved|verified|available|loaded|ready/i.test(value)) return "good";
  if (/waiting|queued|generating|uploading|persisting|validating|reviewing|revising|pending|warning/i.test(value)) return "warning";
  return "danger";
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
      brandProfile: "Preview mode"
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
      swatches: ["#4f46e5", "#173c7a", "#0f172a", "#dbeafe", "#f8fafc", "#e2e8f0"],
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
    quality: {
      brief: 0,
      brand: 0,
      composition: 0,
      technical: 0,
      originality: 0,
      safety: 100
    },
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

function variantTone(status: ImageGenerationState) {
  if (status === "Completed") return styles.variantReady;
  if (["Generating", "Uploading", "Persisting", "Validating", "Reviewing", "Revising"].includes(status)) return styles.variantCurrent;
  if (["Blocked", "Failed"].includes(status)) return styles.variantFailed;
  return "";
}

function stateTone(state: string) {
  if (/completed/i.test(state)) return "good";
  if (/blocked|failed/i.test(state)) return "danger";
  return "warning";
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
      setLastSyncAt(new Date().toISOString());
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
    void runAutonomousCycle();
    const interval = window.setInterval(() => {
      void runAutonomousCycle();
    }, AUTONOMY_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [runAutonomousCycle]);

  const productions = useMemo(() => {
    return [...(data?.productions ?? [])].sort((left, right) => {
      const score = (item: ImageGeneratorProduction) => {
        if (item.state === "Failed") return 5;
        if (item.state === "Blocked") return 4;
        if (["Reviewing", "Revising", "Validating"].includes(item.state)) return 3;
        if (["Generating", "Uploading", "Persisting"].includes(item.state)) return 2;
        if (item.state === "Completed") return 0;
        return 1;
      };
      const delta = score(right) - score(left);
      if (delta !== 0) return delta;
      return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
    });
  }, [data]);

  const primary = productions[0];
  const content = useMemo<WorkspaceProduction | null>(() => {
    if (primary) {
      return { ...primary, preview: false };
    }
    if (isDevelopmentPreviewEnabled()) {
      return buildDevelopmentPreview(lastSyncAt, error ?? (loading ? "Waiting for persisted production data." : undefined));
    }
    return null;
  }, [primary, lastSyncAt, error, loading]);

  const activeVariant = useMemo(() => findActiveVariant(content), [content]);
  const connected = Boolean(primary) && !error;

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

  if (!content) {
    return (
      <section className={styles.embeddedPage}>
        <section className={styles.content}>
          <div className={styles.titleRow}>
            <div>
              <h1>Autonomous Image Generator</h1>
              <p>Production-driven visual generation, persistence, validation, review, revision, and routing.</p>
            </div>
            <button className={styles.actionButton} disabled>
              <LockKeyhole />
              <span>
                Approve &amp; Route
                <small>Unlocked only after autonomous completion</small>
              </span>
            </button>
          </div>

          {error ? (
            <div className={`${styles.banner} ${styles.warningBanner}`}>
              <AlertTriangle />
              <span>
                <strong>Autonomous engine degraded.</strong> {error}
              </span>
            </div>
          ) : null}

          <section className={`${styles.panel} ${styles.emptyState}`}>
            <ImageIcon />
            <div>
              <h3>No persisted image generation candidate is available.</h3>
              <p>The workspace waits for a production in `storyboard`, `visual-generation`, or `assembly` and will not fabricate a completed preview.</p>
            </div>
          </section>
        </section>
      </section>
    );
  }

  return (
    <section className={styles.embeddedPage}>
      <section className={styles.content}>
        <div className={styles.titleRow}>
          <div>
            <h1>Autonomous Image Generator</h1>
            <p>Production-driven visual generation, persistence, validation, browser verification, review, revision, and routing.</p>
          </div>
          <button className={styles.actionButton} disabled>
            <LockKeyhole />
            <span>
              Approve &amp; Route
              <small>Available only after persisted asset validation completes</small>
            </span>
          </button>
        </div>

        {error ? (
          <div className={`${styles.banner} ${styles.warningBanner}`}>
            <AlertTriangle />
            <span>
              <strong>Autonomous engine degraded.</strong> {error}
            </span>
          </div>
        ) : null}

        {content.preview ? (
          <div className={`${styles.banner} ${styles.warningBanner}`}>
            <AlertTriangle />
            <span>
              <strong>Development preview mode.</strong> This mode never creates completed variants, never passes quality gates, and never replaces the production pipeline.
            </span>
          </div>
        ) : null}

        <div className={styles.contextBar}>
          <DataCell label="Production" value={content.code} sub={content.title} />
          <DataCell label="Asset Request" value={content.asset} />
          <DataCell label="Pipeline Stage" value={content.stage} />
          <DataCell label="State" value={content.state} tone={stateTone(content.state)} />
          <DataCell label="Priority" value={content.priority} />
          <DataCell label="Updated" value={formatTime(content.updatedAt)} sub={connected ? "Live sync" : "Development preview"} />
          <div className={styles.contextAction}>
            <small>Routing</small>
            <b>{content.routing.status}</b>
            <span>{content.routing.target}</span>
          </div>
        </div>

        <Workflow active={content.step} state={content.state} />

        <div className={styles.workspace}>
          <div className={styles.leftColumn}>
            <Panel title="Persisted Visual Brief" tag={content.preview ? "Development" : "Persisted"}>
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

            <Panel title="Generation Constraints" tag="Enforced">
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

            <Panel title="Reference & Evidence" tag={`${content.references.length} persisted`}>
              <div className={styles.referenceList}>
                {content.references.map((reference) => (
                  <p className={styles.referenceRow} key={reference.id}>
                    <Database />
                    <span>{reference.id}</span>
                    <Check />
                  </p>
                ))}
              </div>
            </Panel>

            <Panel title="Brand Visual Profile" tag={`${content.brand.match}% match`}>
              <div className={styles.swatches}>
                {content.brand.swatches.map((swatch) => (
                  <i key={swatch} style={{ backgroundColor: swatch }} />
                ))}
              </div>
              <Rows
                items={[
                  ["Tone", content.brand.tone],
                  ["Brand", content.brand.profile]
                ]}
              />
            </Panel>
          </div>

          <div className={styles.centerColumn}>
            <section className={styles.previewCard}>
              <div className={styles.previewTop}>
                <div>
                  <b>
                    Variant {content.variant} of {content.variantCount}
                  </b>
                  <span>{content.stepLabel}</span>
                </div>
                <div className={styles.previewMeta}>
                  <small>
                    <Radio />
                    {content.preview
                      ? "Development preview only"
                      : content.activeAssetUrl
                        ? "Persisted image asset"
                        : "Waiting for persisted asset"}
                  </small>
                  <strong>{content.progress}% complete</strong>
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
                    <div className={styles.canvasCaption}>
                      <ImageIcon />
                      <span>{content.brief.subject}</span>
                    </div>
                    <div className={styles.assetBadge}>
                      <HardDriveDownload size={14} />
                      <span>{content.activeAssetId ?? "Persisting asset"}</span>
                    </div>
                    {imageLoadState === "loading" ? (
                      <div className={styles.assetOverlay}>
                        <b>Loading persisted asset URL</b>
                        <span>The variant will not complete until the browser acknowledges a successful image load.</span>
                      </div>
                    ) : null}
                    {imageLoadState === "failed" ? (
                      <div className={`${styles.assetOverlay} ${styles.assetOverlayError}`}>
                        <b>Image load failed</b>
                        <span>{imageLoadError ?? "The browser could not load the persisted image URL."}</span>
                      </div>
                    ) : null}
                  </>
                ) : (
                  <div className={styles.emptyCanvas}>
                    <ImageIcon />
                    <b>{content.preview ? "Development preview only" : "No persisted image asset yet"}</b>
                    <span>
                      {content.preview
                        ? "Preview mode never creates completed variants or truthful production progress."
                        : `Current truthful state: ${content.state}. ${content.failureReason ?? content.agent.nextAction}`}
                    </span>
                  </div>
                )}
              </div>

              <div className={styles.previewPrompt}>
                <small>Current Prompt</small>
                <p>{content.prompt}</p>
              </div>

              <div className={styles.variantRail}>
                {content.variants.map((variant) => (
                  <div key={variant.id} className={`${styles.variantCard} ${variantTone(variant.status)}`}>
                    {variant.assetUrl ? (
                      <img className={styles.variantThumbImage} src={variant.assetUrl} alt={`${variant.label} thumbnail`} />
                    ) : (
                      <div className={styles.variantThumb}>
                        <small>{variant.status}</small>
                      </div>
                    )}
                    <b>{variant.label}</b>
                    <span>{variant.note}</span>
                    <em className={styles[normalizeTone(variant.status)]}>{variant.status}</em>
                  </div>
                ))}
              </div>
            </section>

            <div className={styles.centerBottom}>
              <Panel title="Recovery & Issues" tag={`${content.issues.length} open`}>
                <div className={styles.issueList}>
                  {content.issues.map((issue) => (
                    <div className={styles.issueRow} key={`${issue.title}-${issue.detail}`}>
                      <AlertTriangle />
                      <div>
                        <b>{issue.title}</b>
                        <small>{issue.detail}</small>
                      </div>
                      <em className={styles[normalizeTone(issue.status)]}>{issue.status}</em>
                    </div>
                  ))}
                </div>
              </Panel>

              <Panel title="Persisted Asset Integrity" tag={content.activeAssetId ? "Live" : "Waiting"}>
                <Rows
                  compact
                  items={[
                    ["Asset ID", content.activeAssetId ?? "Not persisted"],
                    ["Asset URL", content.activeAssetUrl ?? "Waiting for persisted URL"],
                    ["MIME Type", activeVariant?.mimeType ?? "Not recorded"],
                    ["File Size", formatBytes(activeVariant?.fileSizeBytes)],
                    ["Dimensions", activeVariant?.width && activeVariant?.height ? `${activeVariant.width} x ${activeVariant.height}` : "Not recorded"],
                    ["Checksum", activeVariant?.checksumSha256 ?? "Not recorded"],
                    ["Browser Load", content.browserLoadStatus]
                  ]}
                />
              </Panel>
            </div>
          </div>

          <div className={styles.rightColumn}>
            <Panel title="Live Agent Execution" tag={content.preview ? "Development" : connected ? "System online" : "Awaiting sync"}>
              <Rows
                compact
                items={[
                  ["Agent", content.agent.name],
                  ["Model", content.agent.model],
                  ["Current Action", content.agent.action],
                  ["Elapsed Time", formatDuration(content.agent.elapsedSeconds)],
                  ["Worker Heartbeat", content.workerHeartbeatAt ? formatTime(content.workerHeartbeatAt) : content.agent.heartbeat],
                  ["Retry Count", String(content.agent.retryCount)],
                  ["Next Action", content.agent.nextAction]
                ]}
              />
              <TelemetryBlock label="Failure Reason" value={content.failureReason ?? "None"} tone={content.failureReason ? "danger" : "good"} />
              <TelemetryBlock label="Storage Result" value={content.storageResult ?? content.agent.storageResult} />
              <TelemetryBlock label="Model Response" value={content.agent.modelResponse} />
            </Panel>

            <Panel title="Quality & Compliance" tag={content.preview ? "Disabled in preview" : "Live"}>
              <Metric label="Brief fidelity" value={content.quality.brief} icon={<Sparkles size={14} />} />
              <Metric label="Brand alignment" value={content.quality.brand} icon={<Palette size={14} />} />
              <Metric label="Composition" value={content.quality.composition} icon={<ImageIcon size={14} />} />
              <Metric label="Technical quality" value={content.quality.technical} icon={<Activity size={14} />} />
              <Metric label="Originality" value={content.quality.originality} icon={<Bot size={14} />} />
              <Metric label="Safety" value={content.quality.safety} icon={<ShieldCheck size={14} />} />
            </Panel>

            <Panel title="Version History" tag={`${content.versions.length} versions`}>
              <div className={styles.versionList}>
                {content.versions.map((version) => (
                  <div className={styles.versionRow} key={`${version.id}-${version.createdAt}`}>
                    <b>{version.id}</b>
                    <span>{version.note}</span>
                    <time>{formatTime(version.createdAt)}</time>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel title="Autonomous Decisions" tag="Latest">
              <div className={styles.decisionList}>
                {content.decisions.map((decision) => (
                  <div className={styles.decisionRow} key={`${decision.createdAt}-${decision.text}`}>
                    <i className={decision.highlighted ? styles.decisionHot : undefined} />
                    <time>{formatTime(decision.createdAt)}</time>
                    <span>{decision.text}</span>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        </div>
      </section>
    </section>
  );
}

function Workflow({ active, state }: { active: number; state: ImageGenerationState }) {
  return (
    <div className={styles.workflow}>
      {WORKFLOW_STEPS.map((step, index) => {
        const done = index < active || state === "Completed";
        const current = state !== "Completed" && index === active;
        return (
          <div key={step} className={styles.workflowSegment}>
            <div className={`${styles.step} ${done ? styles.done : current ? styles.current : ""}`}>
              <span>{done ? <Check /> : index + 1}</span>
              <div>
                <b>{step}</b>
                <small>{done ? "Complete" : current ? "In progress" : "Pending"}</small>
              </div>
            </div>
            {index < WORKFLOW_STEPS.length - 1 ? <div className={`${styles.stepLine} ${done ? styles.done : ""}`} /> : null}
          </div>
        );
      })}
    </div>
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
      <b
        className={
          tone === "warning"
            ? styles.warningText
            : tone === "danger"
              ? styles.dangerText
              : tone === "good"
                ? styles.goodText
                : undefined
        }
      >
        {value}
      </b>
      {sub ? <span>{sub}</span> : null}
    </div>
  );
}

function Panel({
  title,
  tag,
  children
}: {
  title: string;
  tag: string;
  children: ReactNode;
}) {
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

function TelemetryBlock({
  label,
  value,
  tone
}: {
  label: string;
  value: string;
  tone?: "good" | "danger";
}) {
  return (
    <div className={styles.telemetryBlock}>
      <small>{label}</small>
      <pre className={tone === "danger" ? styles.telemetryDanger : tone === "good" ? styles.telemetryGood : undefined}>{value}</pre>
    </div>
  );
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

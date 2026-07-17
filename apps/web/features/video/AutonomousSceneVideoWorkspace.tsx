"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Check,
  ChevronRight,
  Clock3,
  Database,
  Film,
  LockKeyhole,
  Play,
  Radio,
  ShieldCheck,
  Square
} from "lucide-react";
import type { SceneVideoPayload, SceneVideoProduction } from "@/lib/scene-video-engine";
import styles from "./AutonomousSceneVideoWorkspace.module.css";

const REFRESH_INTERVAL_MS = 10_000;
const AUTONOMY_INTERVAL_MS = 15_000;
const WORKFLOW_STEPS = [
  "Inputs validated",
  "Assets resolved",
  "Rendering frames",
  "Temporal QA",
  "Auto-correction",
  "Timeline ready"
] as const;

async function readApiPayload<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => ({}))) as { message?: string } & T;
  if (!response.ok) {
    throw new Error(payload.message || "The scene video workspace request failed.");
  }
  return payload;
}

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
  if (!value) return "--:--:--";
  return new Intl.DateTimeFormat("en-NG", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).format(new Date(value));
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

function buildWaitingWorkspace(lastSync: string | null, reason?: string): SceneVideoProduction {
  const updatedAt = lastSync ?? new Date().toISOString();
  return {
    id: "scene-video-waiting",
    code: "QUEUE-WAIT",
    title: "Awaiting scene-video-ready production",
    scene: "Waiting for storyboard scene",
    shot: "Waiting for storyboard shot",
    chapter: "Chapter 01 · Scene Video Handoff",
    stage: "Video",
    priority: "Medium",
    state: "Waiting for Storyboard",
    step: 0,
    progress: 12,
    updatedAt,
    resolution: "1920×1080",
    fps: 24,
    durationSeconds: 0,
    renderedFrames: 0,
    totalFrames: 0,
    qualityScore: 0,
    brief: {
      objective: "Claim the next persisted storyboard and approved visual package automatically.",
      scene: "No active storyboard scene",
      shot: "No active storyboard shot",
      narration: "Narration alignment will appear after storyboard handoff.",
      duration: "00:00",
      camera: "Awaiting storyboard camera plan",
      style: "Cinematic corporate",
      brand: "CACSMS Corporate 2026"
    },
    assets: [
      {
        id: "storyboard",
        label: "Storyboard package",
        status: "Waiting for persisted storyboard scene package",
        checksum: null,
        ready: false
      },
      {
        id: "visual",
        label: "Approved image asset",
        status: "Waiting for browser-verified visual asset",
        checksum: null,
        ready: false
      },
      {
        id: "narration",
        label: "Narration timing source",
        status: "Waiting for narration alignment",
        checksum: null,
        ready: false
      }
    ],
    motion: {
      start: "Awaiting storyboard motion plan",
      end: "Awaiting storyboard focal target",
      focal: "Waiting for active shot",
      curve: "Awaiting camera curve",
      parallax: "Awaiting scene depth cues",
      speed: "Awaiting worker",
      stabilization: "Enabled",
      transition: "Awaiting continuity rule"
    },
    continuity: {
      previous: "Waiting for previous scene context",
      following: "Waiting for next scene context",
      environment: "Awaiting environment continuity context",
      lighting: "Awaiting image lighting profile",
      palette: "CACSMS Corporate 2026",
      direction: "Awaiting camera direction"
    },
    constraints: {
      resolution: "1920×1080",
      frameRate: "24 fps",
      maxDuration: "00:00",
      safety: "No fabricated completion, no unverified routing, no unsafe or unapproved content."
    },
    preview: {
      assetUrl: null,
      label: "Waiting for visual source",
      tile: "Waiting for Storyboard",
      assetStatus: "Not stored"
    },
    quality: {
      storyboard: 0,
      temporal: 0,
      motion: 0,
      subject: 0,
      frameQuality: 0,
      audio: 0,
      brand: 0,
      safety: 0
    },
    issues: [
      {
        id: "waiting",
        title: "Scene-video orchestration is waiting for a storyboard-ready handoff.",
        detail:
          reason ??
          "The scene video engine will not fabricate renders, takes, or timeline routing until persisted storyboard and visual prerequisites exist.",
        severity: "critical",
        status: "Waiting",
        autoFix: "Continue autonomous polling until storyboard and visual prerequisites are verified.",
        resolved: false
      }
    ],
    takes: [
      {
        id: "take-awaiting",
        label: "Take 01",
        status: "Waiting",
        detail: "Waiting for the first render-safe package.",
        current: true
      }
    ],
    versions: [],
    decisions: [
      {
        createdAt: updatedAt,
        text: "The scene video engine is polling for the next storyboard and image package."
      }
    ],
    agent: {
      name: "Video Agent Alpha",
      model: "CACSMS Scene Video Orchestrator v1",
      action: "Monitoring storyboard and visual handoff prerequisites.",
      elapsedSeconds: 0,
      heartbeat: `Video sync · ${updatedAt}`,
      retryCount: 0,
      frames: "0 / 0",
      speed: "Awaiting worker",
      gpu: "Idle",
      confidence: "Building",
      nextAction: "Claim the next scene-video-ready package automatically.",
      eta: "Pending"
    },
    routing: {
      status: "Locked pending scene-video rendering and QA",
      next: "Scene Video Generator render pass",
      then: "Timeline Studio",
      approved: false,
      updatedAt
    },
    adapter: {
      apiEndpoint: "/api/video/scene-video-generator",
      eventStreamEndpoint: "/api/video/scene-video-generator/events",
      mode: "polling",
      live: false,
      lastSync: updatedAt,
      detail: "Polling adapter is active. SSE endpoint remains reserved until runtime event streaming is enabled."
    },
    recovery: "Continue autonomous polling until a verified storyboard scene and visual asset are available.",
    currentAction: "Waiting for storyboard to persist a render-safe scene and shot package."
  };
}

function deriveFrames(content: SceneVideoProduction) {
  if (!content.totalFrames) return [];
  const sampleCount = Math.min(8, Math.max(4, Math.ceil(content.totalFrames / 12)));
  return Array.from({ length: sampleCount }, (_, index) => {
    const frame = Math.max(1, Math.round(((index + 1) * content.totalFrames) / sampleCount));
    const rendered = content.renderedFrames >= frame;
    const current =
      !rendered &&
      (content.state === "Rendering" || content.state === "Queued for Render") &&
      index === Math.min(sampleCount - 1, Math.floor((content.renderedFrames / Math.max(1, content.totalFrames)) * sampleCount));
    return {
      frame,
      status: rendered ? "Rendered" : current ? (content.state === "Rendering" ? "Rendering" : "Queued") : "Pending",
      current
    };
  });
}

export function AutonomousSceneVideoWorkspace({
  initial,
  error
}: {
  initial?: SceneVideoPayload;
  error?: string;
}) {
  const [payload, setPayload] = useState<SceneVideoPayload | undefined>(initial);
  const [requestError, setRequestError] = useState<string | null>(error ?? null);
  const [lastSync, setLastSync] = useState<string | null>(initial?.generatedAt ?? null);
  const [cycleRunning, setCycleRunning] = useState(false);
  const [streamMode, setStreamMode] = useState<"sse" | "polling">("polling");
  const [streamLive, setStreamLive] = useState(false);
  const [adapterDetail, setAdapterDetail] = useState(
    initial?.productions[0]?.adapter.detail ??
      "Polling adapter is active. SSE endpoint remains reserved until runtime event streaming is enabled."
  );

  const refresh = useCallback(async () => {
    try {
      const data = await readApiPayload<SceneVideoPayload>(await fetch("/api/video/scene-video-generator", { cache: "no-store" }));
      setPayload(data);
      setLastSync(data.generatedAt);
      setRequestError(null);
    } catch (refreshError) {
      setRequestError(refreshError instanceof Error ? refreshError.message : "Scene video workspace refresh failed.");
    }
  }, []);

  const runScheduler = useCallback(async () => {
    setCycleRunning(true);
    try {
      const data = await readApiPayload<SceneVideoPayload>(
        await fetch("/api/video/scene-video-generator", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "scheduler" })
        })
      );
      setPayload(data);
      setLastSync(data.generatedAt);
      setRequestError(null);
    } catch (schedulerError) {
      setRequestError(schedulerError instanceof Error ? schedulerError.message : "Scene video scheduler failed.");
    } finally {
      setCycleRunning(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => {
      void refresh();
    }, REFRESH_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [refresh]);

  useEffect(() => {
    const eventSource = new EventSource("/api/video/scene-video-generator/events");

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as Partial<SceneVideoPayload> & { message?: string };

        if (typeof data.message === "string" && typeof data.generatedAt !== "string") {
          setStreamLive(false);
          setStreamMode("polling");
          setAdapterDetail(data.message);
          return;
        }

        if (typeof data.generatedAt === "string") {
          const nextPayload = data as SceneVideoPayload;
          setPayload(nextPayload);
          setLastSync(nextPayload.generatedAt);
          setRequestError(null);
          setStreamLive(true);
          setStreamMode("sse");
          setAdapterDetail("SSE event stream is active with polling fallback protection.");
        }
      } catch {
        setStreamLive(false);
        setStreamMode("polling");
        setAdapterDetail("Scene-video SSE payload could not be parsed. Polling fallback is active.");
      }
    };

    eventSource.onerror = () => {
      setStreamLive(false);
      setStreamMode("polling");
      setAdapterDetail("SSE connection is unavailable. Polling fallback remains active.");
    };

    return () => {
      eventSource.close();
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void runScheduler();
    }, AUTONOMY_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [runScheduler]);

  const content = useMemo(
    () => payload?.productions[0] ?? buildWaitingWorkspace(lastSync, requestError ?? undefined),
    [lastSync, payload, requestError]
  );
  const frames = useMemo(() => deriveFrames(content), [content]);
  const issue = content.issues.find((entry) => !entry.resolved) ?? content.issues[0] ?? null;
  const adapter = {
    ...content.adapter,
    mode: streamMode,
    live: streamLive,
    detail: adapterDetail,
    lastSync: lastSync ?? content.adapter.lastSync
  } as const;

  return (
    <div className={styles.page}>
      <div className={styles.headerShell}>
        <div>
          <div className={styles.kicker}>AUTONOMOUS SCENE VIDEO GENERATOR</div>
          <h1>Autonomous Scene Video Generator</h1>
          <p>Storyboard-driven scene synthesis, temporal consistency, cinematic QA, and timeline routing without manual rendering controls.</p>
        </div>
        <div className={styles.headerStatus}>
          <div className={styles.clockCard}>
            <Clock3 size={15} />
            <span>{formatClock(lastSync)}</span>
            <small>Last sync · {formatTime(lastSync)}</small>
          </div>
          <span className={`${styles.statusPill} ${/ready/i.test(content.state) ? styles.goodPill : styles.warningPill}`}>
            <Film size={14} />
            {content.state}
          </span>
          <button className={styles.runtimeButton} disabled>
            <Activity size={14} />
            <span>
              {cycleRunning ? "Autonomy Cycle Running" : "Autonomy Runtime"}
              <small>{content.currentAction}</small>
            </span>
          </button>
          <div className={styles.agentBadge}>
            <b>{content.agent.name.slice(0, 2).toUpperCase()}</b>
            <span>
              {content.agent.name}
              <small>{content.agent.model}</small>
            </span>
          </div>
          <button className={styles.routeButton} disabled>
            <LockKeyhole size={15} />
            <span>
              Approve &amp; Route
              <small>{content.routing.status}</small>
            </span>
          </button>
        </div>
      </div>

      {requestError ? (
        <div className={`${styles.banner} ${styles.dangerBanner}`}>
          <AlertTriangle size={16} />
          <span>{requestError}</span>
        </div>
      ) : null}

      {!requestError && issue ? (
        <div className={`${styles.banner} ${issue.severity === "critical" ? styles.dangerBanner : styles.warningBanner}`}>
          <AlertTriangle size={16} />
          <span>{issue.detail}</span>
        </div>
      ) : null}

      {!requestError && !issue ? (
        <div className={`${styles.banner} ${styles.goodBanner}`}>
          <Check size={16} />
          <span>Scene video gates are healthy and routing remains controlled by persisted rendering and QA state.</span>
        </div>
      ) : null}

      <div className={styles.context}>
        <div className={styles.cell}>
          <small>Job ID</small>
          <b>{content.code}</b>
          <span>{content.title}</span>
        </div>
        <div className={styles.cell}>
          <small>Scene</small>
          <b>{content.scene}</b>
          <span>{content.chapter}</span>
        </div>
        <div className={styles.cell}>
          <small>Shot</small>
          <b>{content.shot}</b>
        </div>
        <div className={styles.cell}>
          <small>Stage</small>
          <b>{content.stage}</b>
        </div>
        <div className={styles.cell}>
          <small>State</small>
          <b className={styles.warningText}>{content.state}</b>
        </div>
        <div className={styles.cell}>
          <small>Output</small>
          <b>
            {content.resolution} · {content.fps}fps
          </b>
        </div>
        <button className={styles.contextButton} disabled>
          <LockKeyhole size={13} />
          Approve &amp; Route
          <small>Disabled until gates pass</small>
        </button>
      </div>

      <div className={styles.flow}>
        {WORKFLOW_STEPS.map((step, index) => (
          <div className={styles.flowSegment} key={step}>
            <div className={`${styles.flowStep} ${index < content.step ? styles.done : index === content.step ? styles.current : styles.pending}`}>
              <i>{index < content.step ? <Check size={13} /> : index + 1}</i>
              <span>
                <b>{step}</b>
                <small>{index < content.step ? "Complete" : index === content.step ? "In progress" : "Pending"}</small>
              </span>
            </div>
            {index < WORKFLOW_STEPS.length - 1 ? <em className={index < content.step ? styles.done : ""} /> : null}
          </div>
        ))}
      </div>

      <div className={`${styles.grid} ${styles.videog}`}>
        <div className={styles.left}>
          <section className={styles.card}>
            <div className={styles.cardTitle}>
              <h3>Persisted Scene Brief</h3>
              <span>{content.code}</span>
            </div>
            <dl className={styles.rows}>
              <dt>Objective</dt>
              <dd>{content.brief.objective}</dd>
              <dt>Scene</dt>
              <dd>{content.brief.scene}</dd>
              <dt>Shot</dt>
              <dd>{content.brief.shot}</dd>
              <dt>Narration</dt>
              <dd>{content.brief.narration}</dd>
              <dt>Duration</dt>
              <dd>{content.brief.duration}</dd>
              <dt>Camera</dt>
              <dd>{content.brief.camera}</dd>
              <dt>Style</dt>
              <dd>{content.brief.style}</dd>
              <dt>Brand</dt>
              <dd>{content.brief.brand}</dd>
            </dl>
          </section>

          <section className={styles.card}>
            <div className={styles.cardTitle}>
              <h3>Input Assets</h3>
              <span>{content.assets.filter((asset) => asset.ready).length}/{content.assets.length} READY</span>
            </div>
            <div className={styles.referenceList}>
              {content.assets.map((asset) => (
                <p className={styles.reference} key={asset.id}>
                  <Database size={13} />
                  <span>
                    <b>{asset.label}</b>
                    <small>{asset.status}</small>
                  </span>
                  {asset.ready ? <Check size={13} /> : <AlertTriangle size={13} />}
                </p>
              ))}
            </div>
          </section>

          <section className={styles.card}>
            <div className={styles.cardTitle}>
              <h3>Motion &amp; Camera Plan</h3>
              <span>RESOLVED</span>
            </div>
            <dl className={styles.rows}>
              <dt>Start</dt>
              <dd>{content.motion.start}</dd>
              <dt>End</dt>
              <dd>{content.motion.end}</dd>
              <dt>Focal</dt>
              <dd>{content.motion.focal}</dd>
              <dt>Curve</dt>
              <dd>{content.motion.curve}</dd>
              <dt>Parallax</dt>
              <dd>{content.motion.parallax}</dd>
              <dt>Speed</dt>
              <dd>{content.motion.speed}</dd>
              <dt>Stabilization</dt>
              <dd>{content.motion.stabilization}</dd>
              <dt>Transition</dt>
              <dd>{content.motion.transition}</dd>
            </dl>
          </section>

          <section className={styles.card}>
            <div className={styles.cardTitle}>
              <h3>Continuity References</h3>
              <span>STABLE</span>
            </div>
            <dl className={styles.rows}>
              <dt>Previous</dt>
              <dd>{content.continuity.previous}</dd>
              <dt>Following</dt>
              <dd>{content.continuity.following}</dd>
              <dt>Environment</dt>
              <dd>{content.continuity.environment}</dd>
              <dt>Lighting</dt>
              <dd>{content.continuity.lighting}</dd>
              <dt>Palette</dt>
              <dd>{content.continuity.palette}</dd>
              <dt>Direction</dt>
              <dd>{content.continuity.direction}</dd>
            </dl>
          </section>

          <section className={styles.card}>
            <div className={styles.cardTitle}>
              <h3>Generation Constraints</h3>
              <span>ENFORCED</span>
            </div>
            <dl className={styles.rows}>
              <dt>Resolution</dt>
              <dd>{content.constraints.resolution}</dd>
              <dt>Frame Rate</dt>
              <dd>{content.constraints.frameRate}</dd>
              <dt>Max Duration</dt>
              <dd>{content.constraints.maxDuration}</dd>
              <dt>Safety</dt>
              <dd>{content.constraints.safety}</dd>
            </dl>
          </section>
        </div>

        <div className={styles.center}>
          <div className={styles.video}>
            <div className={styles.renderLabel}>
              <b>
                {content.state === "Rendering"
                  ? `Rendering Frames ${String(Math.max(1, content.renderedFrames + 1)).padStart(3, "0")}–${String(
                      Math.min(content.totalFrames, content.renderedFrames + 8)
                    ).padStart(3, "0")}`
                  : content.state}
              </b>
              <span>
                {content.scene} · {content.shot}
              </span>
            </div>
            <div className={styles.controlRoom}>
              {content.preview.assetUrl ? (
                <img className={styles.previewImage} src={content.preview.assetUrl} alt={content.preview.label} />
              ) : null}
              <div className={styles.wall}>
                <b>{content.scene}</b>
                <span>{content.preview.assetUrl ? "▥ ▤ ▦" : "WAITING FOR VERIFIED VISUAL SOURCE"}</span>
              </div>
              <div className={styles.people}>● ● ● ● ●</div>
            </div>
            <div className={styles.controls}>
              {content.state === "Rendering" ? <Play size={14} /> : <Square size={14} />}
              <div>
                <i style={{ width: `${content.totalFrames ? (content.renderedFrames / content.totalFrames) * 100 : 0}%` }} />
              </div>
              <span>
                {content.totalFrames
                  ? `${formatDuration(Math.round(content.renderedFrames / Math.max(1, content.fps)))} / ${formatDuration(content.durationSeconds)}`
                  : "00:00 / 00:00"}
              </span>
              <b>{content.agent.frames}</b>
            </div>
          </div>

          <div className={styles.frames}>
            {frames.length ? (
              frames.map((frame) => (
                <div className={frame.current ? styles.currentFrame : ""} key={frame.frame}>
                  <div>{content.preview.assetUrl ? "▥ ▤ ▦" : "…"}</div>
                  <b>{frame.frame}</b>
                  <span>{frame.status}</span>
                </div>
              ))
            ) : (
              <div className={styles.emptyFrame}>Frame strip will populate after a render-safe package is persisted.</div>
            )}
          </div>

          <section className={styles.card}>
            <div className={styles.cardTitle}>
              <h3>Motion &amp; Camera Trajectory</h3>
              <span>LIVE</span>
            </div>
            <div className={styles.trajectory}>
              Start {content.motion.start} <b>●━━━━●━━━━●━━━━●</b> End {content.motion.end}
            </div>
            <div className={styles.audioWave}>Narration &amp; Audio {content.brief.narration}</div>
          </section>

          <div className={styles.action}>
            <Activity size={15} />
            <div>
              <small>Current Autonomous Action</small>
              <b>{content.currentAction}</b>
            </div>
            <strong>{content.progress}%</strong>
          </div>

          <div className={styles.takes}>
            {content.takes.map((take) => (
              <div className={take.current ? styles.currentTake : ""} key={take.id}>
                <b>{take.label}</b>
                <span>{take.status}</span>
                <small>{take.detail}</small>
              </div>
            ))}
          </div>

          <div className={styles.bottom}>
            <section className={styles.card}>
              <div className={styles.cardTitle}>
                <h3>Blockers &amp; Recovery</h3>
                <span>{content.issues.length} ISSUE</span>
              </div>
              {issue ? (
                <>
                  <p className={styles.warning}>
                    <AlertTriangle size={13} />
                    {issue.title}
                  </p>
                  <p className={styles.ok}>
                    <Check size={12} />
                    {issue.autoFix ?? content.recovery ?? "Autonomous recovery is active."}
                  </p>
                </>
              ) : (
                <p className={styles.ok}>
                  <Check size={12} />
                  {content.recovery ?? "Scene-video package is healthy."}
                </p>
              )}
            </section>

            <section className={styles.card}>
              <div className={styles.cardTitle}>
                <h3>Video Metadata</h3>
                <span>WRITING</span>
              </div>
              <dl className={styles.rows}>
                <dt>Format</dt>
                <dd>MP4 / H.264</dd>
                <dt>Resolution</dt>
                <dd>{content.resolution}</dd>
                <dt>Frame Rate</dt>
                <dd>{content.fps} fps</dd>
                <dt>Duration</dt>
                <dd>{formatDuration(content.durationSeconds)}</dd>
                <dt>Storage</dt>
                <dd>{content.preview.assetStatus}</dd>
              </dl>
            </section>

            <section className={styles.card}>
              <div className={styles.cardTitle}>
                <h3>Routing Status</h3>
                <span>{content.routing.approved ? "OPEN" : "LOCKED"}</span>
              </div>
              <dl className={styles.rows}>
                <dt>Status</dt>
                <dd>{content.routing.status}</dd>
                <dt>Next</dt>
                <dd>{content.routing.next}</dd>
                <dt>Then</dt>
                <dd>{content.routing.then}</dd>
              </dl>
            </section>
          </div>
        </div>

        <div className={styles.right}>
          <section className={styles.card}>
            <div className={styles.cardTitle}>
              <h3>Live Video Agent</h3>
              <span>{adapter.live ? "LIVE API" : "PREVIEW MODE"}</span>
            </div>
            <dl className={styles.rows}>
              <dt>Agent</dt>
              <dd>{content.agent.name}</dd>
              <dt>Model</dt>
              <dd>{content.agent.model}</dd>
              <dt>Action</dt>
              <dd>{content.agent.action}</dd>
              <dt>Elapsed</dt>
              <dd>{formatDuration(content.agent.elapsedSeconds)}</dd>
              <dt>Frames</dt>
              <dd>{content.agent.frames}</dd>
              <dt>Speed</dt>
              <dd>{content.agent.speed}</dd>
              <dt>GPU Usage</dt>
              <dd>{content.agent.gpu}</dd>
              <dt>Confidence</dt>
              <dd>{content.agent.confidence}</dd>
              <dt>Heartbeat</dt>
              <dd>{content.agent.heartbeat}</dd>
              <dt>Retry</dt>
              <dd>{content.agent.retryCount}</dd>
              <dt>ETA</dt>
              <dd>{content.agent.eta}</dd>
              <dt>Next</dt>
              <dd>{content.agent.nextAction}</dd>
            </dl>
          </section>

          <section className={styles.card}>
            <div className={styles.cardTitle}>
              <h3>Video Quality &amp; Compliance</h3>
              <span>{content.routing.approved ? "READY" : "ACTIVE"}</span>
            </div>
            {Object.entries(content.quality).map(([label, value]) => (
              <div className={styles.score} key={label}>
                <span>
                  {label.charAt(0).toUpperCase() + label.slice(1)}
                  <b>{value}%</b>
                </span>
                <div>
                  <i style={{ width: `${value}%` }} />
                </div>
              </div>
            ))}
            <div className={styles.overall}>
              Truthful score <b>{content.qualityScore}%</b>
            </div>
          </section>

          <section className={styles.card}>
            <div className={styles.cardTitle}>
              <h3>Detected Issue</h3>
              <span>{issue ? issue.status : "CLEAR"}</span>
            </div>
            {issue ? (
              <>
                <p className={styles.warning}>
                  <AlertTriangle size={13} />
                  {issue.title}
                </p>
                <div className={styles.mini}>
                  <i style={{ width: `${content.progress}%` }} />
                </div>
              </>
            ) : (
              <p className={styles.ok}>
                <Check size={12} />
                No active scene-video issue is preventing controlled routing.
              </p>
            )}
          </section>

          <section className={styles.card}>
            <div className={styles.cardTitle}>
              <h3>Temporal Consistency</h3>
              <span>MONITORING</span>
            </div>
            <dl className={styles.rows}>
              <dt>Subject</dt>
              <dd>{content.quality.subject > 0 ? "Stable" : "Waiting"}</dd>
              <dt>Environment</dt>
              <dd>{content.continuity.environment}</dd>
              <dt>Geometry</dt>
              <dd>{content.quality.temporal > 0 ? "Tracked" : "Waiting"}</dd>
              <dt>Lighting</dt>
              <dd>{content.continuity.lighting}</dd>
              <dt>Color</dt>
              <dd>{content.continuity.palette}</dd>
              <dt>Motion Vector</dt>
              <dd>{content.motion.curve}</dd>
              <dt>Camera Path</dt>
              <dd>{content.motion.speed}</dd>
            </dl>
          </section>

          <section className={styles.card}>
            <div className={styles.cardTitle}>
              <h3>Version History &amp; Decisions</h3>
              <span>LIVE</span>
            </div>
            <div className={styles.adapterBanner}>
              <Radio size={12} />
              <span>{adapter.live ? "Event stream synchronized" : "Polling protection active"}</span>
            </div>
            <dl className={styles.rows}>
              <dt>API</dt>
              <dd>{adapter.apiEndpoint}</dd>
              <dt>Events</dt>
              <dd>{adapter.eventStreamEndpoint}</dd>
              <dt>Mode</dt>
              <dd>{adapter.mode}</dd>
              <dt>Last Sync</dt>
              <dd>{formatTime(adapter.lastSync)}</dd>
              <dt>Status</dt>
              <dd>{adapter.detail}</dd>
            </dl>
            <div className={styles.versionList}>
              {content.versions.map((version) => (
                <p className={styles.versionRow} key={version.id}>
                  <span>{version.label}</span>
                  <b>{version.status}</b>
                </p>
              ))}
            </div>
            {content.decisions.map((decision) => (
              <p className={`${styles.decision} ${decision.highlighted ? styles.decisionPrimary : ""}`} key={`${decision.createdAt}-${decision.text}`}>
                <i />
                {formatClock(decision.createdAt)} · {decision.text}
              </p>
            ))}
          </section>
        </div>
      </div>
    </div>
  );
}

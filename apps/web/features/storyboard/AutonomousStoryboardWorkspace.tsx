"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Check,
  ChevronRight,
  Clock3,
  Clapperboard,
  Database,
  Film,
  LockKeyhole,
  Monitor,
  Radio,
  ShieldCheck,
  Sparkles
} from "lucide-react";
import type { StoryboardPayload, StoryboardProduction, StoryboardScene, StoryboardShot } from "@/lib/storyboard-engine";
import styles from "./AutonomousStoryboardWorkspace.module.css";

const REFRESH_INTERVAL_MS = 10_000;
const AUTONOMY_INTERVAL_MS = 15_000;
const WORKFLOW_STEPS = [
  "Script validated",
  "Scenes decomposed",
  "Planning shots",
  "Continuity review",
  "Auto-revision",
  "Production ready"
] as const;

async function readApiPayload<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => ({}))) as { message?: string } & T;
  if (!response.ok) {
    throw new Error(payload.message || "The storyboard workspace request failed.");
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
  if (!value) return "Not recorded";
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

function overallQuality(content: StoryboardProduction) {
  return Math.round(
    (content.quality.coverage +
      content.quality.flow +
      content.quality.diversity +
      content.quality.continuity +
      content.quality.timing +
      content.quality.brand +
      content.quality.safety) /
      7
  );
}

function toneClass(state: string) {
  if (/ready|active|sequencing|live/i.test(state)) return styles.goodText;
  if (/blocked|critical|failed/i.test(state)) return styles.dangerText;
  return styles.warningText;
}

function buildWaitingWorkspace(lastSync: string | null, reason?: string): StoryboardProduction {
  const updatedAt = lastSync ?? new Date().toISOString();
  return {
    id: "storyboard-waiting",
    code: "QUEUE-WAIT",
    title: "Awaiting storyboard-ready production",
    chapter: "Chapter 01 · Storyboard handoff",
    stage: "storyboard",
    priority: "Medium",
    state: "Waiting for Script",
    step: 0,
    progress: 8,
    updatedAt,
    durationSeconds: 0,
    sceneCount: 0,
    shotCount: 0,
    versionLabel: "SB-v0",
    brief: {
      objective: "Claim the next persisted script and translate it into storyboard scenes automatically.",
      audience: "Decision-makers and professional audiences",
      duration: "00:00",
      format: "Awaiting production candidate",
      aspectRatio: "16:9",
      visualStyle: "Cinematic corporate",
      brand: "CACSMS Corporate 2026"
    },
    structure: [
      { label: "Hook", percent: 8, durationSeconds: 0 },
      { label: "Context", percent: 16, durationSeconds: 0 },
      { label: "Escalation", percent: 38, durationSeconds: 0 },
      { label: "Resolution", percent: 26, durationSeconds: 0 },
      { label: "CTA", percent: 12, durationSeconds: 0 }
    ],
    sources: [
      {
        id: "waiting-source",
        label: "Waiting for persisted script, sources, and storyboard metadata",
        status: "No storyboard package is fabricated before source data exists"
      }
    ],
    scenes: [],
    activeSceneId: null,
    activeShotId: null,
    quality: {
      coverage: 0,
      flow: 0,
      diversity: 0,
      continuity: 0,
      timing: 0,
      brand: 0,
      safety: 0
    },
    issues: [
      {
        id: "waiting",
        title: "Storyboard is waiting for a persisted script handoff.",
        detail:
          reason ??
          "The autonomous storyboard engine will monitor writing output and will not fabricate scenes, shots, or routing approvals.",
        severity: "critical",
        status: "Waiting",
        autoFix: "Continue scheduler polling until a storyboard-ready production is available.",
        resolved: false
      }
    ],
    versions: [],
    decisions: [
      {
        createdAt: updatedAt,
        text: "Autonomous storyboard polling is active and waiting for a persisted script-ready production."
      }
    ],
    agent: {
      name: "Story Agent Alpha",
      model: "Waiting for storyboard-ready script",
      action: "Monitoring writing output and storyboard queue eligibility",
      elapsedSeconds: 0,
      heartbeat: `Idle · ${formatClock(updatedAt)}`,
      retryCount: 0,
      confidence: "Building",
      nextAction: "Claim the next eligible storyboard production.",
      compute: "0.0 vCPU · 0.0 GB"
    },
    routing: {
      status: "Locked until storyboard gates pass",
      visualStudio: "Waiting for storyboard approval",
      sceneSequencer: "Waiting for storyboard and visual approvals",
      approved: false,
      updatedAt
    },
    adapter: {
      apiEndpoint: "/api/storyboard/storyboard-editor",
      eventStreamEndpoint: "/api/storyboard/storyboard-editor/events",
      mode: "polling",
      live: true,
      lastSync: updatedAt,
      detail: "Polling adapter is active. SSE endpoint remains reserved until runtime event streaming is enabled."
    },
    recovery: "Continue autonomous polling until a valid storyboard candidate is persisted.",
    currentAction: "Waiting for the writing engine to persist storyboard-ready content."
  };
}

function continuityRows(content: StoryboardProduction) {
  const activeIssue = content.issues.find((issue) => !issue.resolved);
  return [
    ["Character", activeIssue?.id === "continuity-risk" ? "Monitoring" : "Consistent"],
    ["Environment", content.sceneCount > 0 ? "Consistent" : "Waiting"],
    ["Geography", content.issues.some((issue) => issue.id === "continuity-risk") ? "Auto-fix active" : "Consistent"],
    ["Timing", content.issues.some((issue) => issue.id === "timing-spread") ? "Balancing" : "Aligned"],
    ["Evidence", content.sources.length > 1 ? "Verified" : "Thin coverage"],
    ["Narration", content.sceneCount > 0 ? "Linked" : "Waiting"]
  ] as const;
}

function activeScene(content: StoryboardProduction) {
  return (
    content.scenes.find((scene) => scene.id === content.activeSceneId) ??
    content.scenes.find((scene) => scene.status === "Planning") ??
    content.scenes[0] ??
    null
  );
}

function activeShot(scene: StoryboardScene | null, content: StoryboardProduction) {
  if (!scene) return null;
  return scene.shots.find((shot) => shot.id === content.activeShotId) ?? scene.shots.find((shot) => shot.status === "Planning") ?? scene.shots[0] ?? null;
}

export function AutonomousStoryboardWorkspace({
  initial,
  error
}: {
  initial?: StoryboardPayload;
  error?: string;
}) {
  const [payload, setPayload] = useState<StoryboardPayload | undefined>(initial);
  const [requestError, setRequestError] = useState<string | null>(error ?? null);
  const [lastSync, setLastSync] = useState<string | null>(initial?.generatedAt ?? null);
  const [cycleRunning, setCycleRunning] = useState(false);
  const [streamMode, setStreamMode] = useState<"sse" | "polling">("polling");
  const [streamLive, setStreamLive] = useState(false);
  const [adapterDetail, setAdapterDetail] = useState(
    initial?.productions[0]?.adapter.detail ??
      "Polling adapter is active. SSE endpoint remains reserved until runtime event streaming is enabled."
  );
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [selectedShotId, setSelectedShotId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await readApiPayload<StoryboardPayload>(await fetch("/api/storyboard/storyboard-editor", { cache: "no-store" }));
      setPayload(data);
      setLastSync(data.generatedAt);
      setRequestError(null);
    } catch (refreshError) {
      setRequestError(refreshError instanceof Error ? refreshError.message : "Storyboard workspace refresh failed.");
    }
  }, []);

  const runScheduler = useCallback(async () => {
    setCycleRunning(true);
    try {
      const data = await readApiPayload<StoryboardPayload>(
        await fetch("/api/storyboard/storyboard-editor", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "scheduler" })
        })
      );
      setPayload(data);
      setLastSync(data.generatedAt);
      setRequestError(null);
    } catch (schedulerError) {
      setRequestError(schedulerError instanceof Error ? schedulerError.message : "Storyboard scheduler failed.");
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
    const eventSource = new EventSource("/api/storyboard/storyboard-editor/events");

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as Partial<StoryboardPayload> & { message?: string };

        if (typeof data.message === "string" && typeof data.generatedAt !== "string") {
          setStreamLive(false);
          setStreamMode("polling");
          setAdapterDetail(data.message);
          return;
        }

        if (typeof data.generatedAt === "string") {
          const nextPayload = data as StoryboardPayload;
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
        setAdapterDetail("Storyboard SSE payload could not be parsed. Polling fallback is active.");
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
  const currentScene = useMemo(
    () => content.scenes.find((scene) => scene.id === selectedSceneId) ?? activeScene(content),
    [content, selectedSceneId]
  );
  const currentShot = useMemo(
    () => currentScene?.shots.find((shot) => shot.id === selectedShotId) ?? activeShot(currentScene, content),
    [content, currentScene, selectedShotId]
  );
  const issue = content.issues[0] ?? null;
  const openIssues = content.issues.filter((entry) => !entry.resolved).length;
  const expectedAssets = content.scenes.reduce((total, scene) => total + scene.assetCount, 0);
  const qualityScore = overallQuality(content);
  const scenePlannedShots = currentScene?.shots.filter((shot) => shot.status !== "Queued").length ?? 0;
  const shotIndex = currentScene && currentShot ? currentScene.shots.findIndex((shot) => shot.id === currentShot.id) + 1 : 0;
  const adapter = {
    ...content.adapter,
    mode: streamMode,
    live: streamLive,
    detail: adapterDetail,
    lastSync: lastSync ?? content.adapter.lastSync
  } as const;

  useEffect(() => {
    setSelectedSceneId(content.activeSceneId ?? content.scenes[0]?.id ?? null);
  }, [content.activeSceneId, content.id, content.scenes]);

  useEffect(() => {
    setSelectedShotId(currentScene?.shots.find((shot) => shot.status === "Planning")?.id ?? currentScene?.shots[0]?.id ?? null);
  }, [currentScene?.id, currentScene?.shots]);

  return (
    <div className={styles.page}>
      <div className={styles.headerShell}>
        <div>
          <div className={styles.kicker}>AUTONOMOUS STORYBOARD EDITOR</div>
          <h1>Autonomous Storyboard Editor</h1>
          <p>Script-to-scene decomposition, camera planning, continuity validation, narration alignment, and controlled downstream routing.</p>
        </div>
        <div className={styles.headerStatus}>
          <div className={styles.clockCard}>
            <Clock3 size={15} />
            <span>{formatClock(lastSync)}</span>
            <small>Last sync · {formatTime(lastSync)}</small>
          </div>
          <span className={`${styles.statusPill} ${/ready|active|sequencing/i.test(content.state) ? styles.goodPill : styles.warningPill}`}>
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
          <span>Storyboard gates are healthy and routing remains controlled by persisted quality state.</span>
        </div>
      ) : null}

      <div className={styles.contextBar}>
        <div className={styles.dataCell}>
          <small>Production</small>
          <b>{content.code}</b>
          <span>{content.title}</span>
        </div>
        <div className={styles.dataCell}>
          <small>Sequence</small>
          <b>{content.chapter}</b>
          <span>{content.versionLabel}</span>
        </div>
        <div className={styles.dataCell}>
          <small>Pipeline Stage</small>
          <b>{content.stage}</b>
          <span>{content.routing.visualStudio}</span>
        </div>
        <div className={styles.dataCell}>
          <small>State</small>
          <b className={toneClass(content.state)}>{content.state}</b>
          <span>{content.currentAction}</span>
        </div>
        <div className={styles.dataCell}>
          <small>Priority</small>
          <b>{content.priority}</b>
          <span>Truthful quality {qualityScore}%</span>
        </div>
        <div className={styles.dataCell}>
          <small>Scenes / Shots</small>
          <b>{content.sceneCount} / {content.shotCount}</b>
          <span>{content.brief.duration}</span>
        </div>
        <div className={styles.contextAction}>
          <small>Controlled Routing</small>
          <b>{content.routing.status}</b>
          <span>{content.routing.sceneSequencer}</span>
        </div>
      </div>

      <div className={styles.workflow}>
        {WORKFLOW_STEPS.map((step, index) => (
          <div className={styles.workflowSegment} key={step}>
            <div
              className={`${styles.step} ${
                index < content.step ? styles.done : index === content.step ? styles.current : styles.pending
              }`}
            >
              <span>{index < content.step ? <Check size={13} /> : index + 1}</span>
              <div>
                <b>{step}</b>
                <small>{index < content.step ? "Complete" : index === content.step ? "In progress" : "Pending"}</small>
              </div>
            </div>
            {index < WORKFLOW_STEPS.length - 1 ? <div className={`${styles.stepLine} ${index < content.step ? styles.done : ""}`} /> : null}
          </div>
        ))}
      </div>

      <div className={styles.summaryStrip}>
        <div className={styles.summaryCard}>
          <Sparkles size={14} />
          <span>
            Storyboard Score
            <b>{qualityScore}% truthful quality</b>
          </span>
        </div>
        <div className={styles.summaryCard}>
          <Radio size={14} />
          <span>
            Adapter State
            <b>{adapter.live ? "SSE live stream active" : "Polling fallback active"}</b>
          </span>
        </div>
        <div className={styles.summaryCard}>
          <AlertTriangle size={14} />
          <span>
            Open Issues
            <b>{openIssues} active autonomous recovery item{openIssues === 1 ? "" : "s"}</b>
          </span>
        </div>
        <div className={styles.summaryCard}>
          <ChevronRight size={14} />
          <span>
            Next Route
            <b>{content.routing.visualStudio}</b>
          </span>
        </div>
      </div>

      <div className={styles.workspace}>
        <div className={styles.leftColumn}>
          <section className={styles.panel}>
            <div className={styles.panelTitle}>
              <h3>Story Brief</h3>
              <span>PERSISTED</span>
            </div>
            <dl className={styles.rows}>
              <dt>Objective</dt>
              <dd>{content.brief.objective}</dd>
              <dt>Audience</dt>
              <dd>{content.brief.audience}</dd>
              <dt>Duration</dt>
              <dd>{content.brief.duration}</dd>
              <dt>Format</dt>
              <dd>{content.brief.format}</dd>
              <dt>Aspect Ratio</dt>
              <dd>{content.brief.aspectRatio}</dd>
              <dt>Visual Style</dt>
              <dd>{content.brief.visualStyle}</dd>
              <dt>Brand</dt>
              <dd>{content.brief.brand}</dd>
            </dl>
          </section>

          <section className={styles.panel}>
            <div className={styles.panelTitle}>
              <h3>Scene Navigator</h3>
              <span>{content.sceneCount} SCENES</span>
            </div>
            <div className={styles.sceneList}>
              {content.scenes.length ? (
                content.scenes.map((scene) => (
                  <button
                    type="button"
                    key={scene.id}
                    className={`${styles.sceneItem} ${currentScene?.id === scene.id ? styles.sceneItemActive : ""}`}
                    onClick={() => setSelectedSceneId(scene.id)}
                  >
                    <b>{String(scene.number).padStart(2, "0")}</b>
                    <span>{scene.title}</span>
                    <small>{scene.status === "Complete" ? "✓" : scene.status === "Planning" ? "●" : "○"}</small>
                  </button>
                ))
              ) : (
                <div className={styles.emptyState}>Storyboard scenes will appear here after the next verified handoff.</div>
              )}
            </div>
          </section>

          <section className={styles.panel}>
            <div className={styles.panelTitle}>
              <h3>Story Structure &amp; Coverage</h3>
              <span>{qualityScore}%</span>
            </div>
            <dl className={styles.compactRows}>
              {content.structure.map((segment) => (
                <div className={styles.rowPair} key={segment.label}>
                  <dt>{segment.label}</dt>
                  <dd>
                    {segment.percent}% · {formatDuration(segment.durationSeconds)}
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          <section className={styles.panel}>
            <div className={styles.panelTitle}>
              <h3>Source &amp; Evidence</h3>
              <span>VERIFIED</span>
            </div>
            <div className={styles.referenceList}>
              {content.sources.map((source) => (
                <div className={styles.referenceRow} key={source.id}>
                  <div className={styles.referenceIcon}>
                    <Database size={13} />
                  </div>
                  <div>
                    <strong>{source.label}</strong>
                    <small>{source.status}</small>
                  </div>
                  <Check size={13} />
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className={styles.centerColumn}>
          <section className={styles.board}>
            <div className={styles.boardHead}>
              <div>
                <h2>{currentScene?.title ?? "Awaiting active scene"}</h2>
                <p>{currentScene?.summary ?? "Storyboard scenes will populate after the writing engine persists a storyboard-ready script."}</p>
                <div className={styles.boardMetrics}>
                  <span>{currentScene?.coverageLabel ?? "Coverage pending"}</span>
                  <span>{currentScene?.continuityStatus ?? "Continuity pending"}</span>
                  <span>{currentScene ? `${currentScene.assetCount} expected assets` : "0 assets"}</span>
                </div>
              </div>
              <b>
                {currentScene ? `${formatDuration(currentScene.durationSeconds)} · ${currentScene.shots.length} shots` : "00:00 · 0 shots"}
              </b>
            </div>

            <div className={styles.heroCanvas}>
              <div className={styles.heroScreen}>
                <div className={styles.heroTopbar}>
                  <span>{currentScene ? `SCENE ${String(currentScene.number).padStart(2, "0")}` : "SCENE --"}</span>
                  <span>{currentShot ? `SHOT ${String(currentShot.number).padStart(2, "0")}` : "SHOT --"}</span>
                </div>
                <div className={styles.heroCenter}>
                  <div className={styles.heroGlyph}>▥ ▤ ▦</div>
                  <strong>{currentShot?.title ?? "Storyboard frame is waiting for a verified shot plan."}</strong>
                  <p>{currentShot?.visualFocus ?? "Visual focus appears here after script-to-scene decomposition completes."}</p>
                </div>
                <div className={styles.heroFooter}>
                  <span>{currentShot?.framing ?? "Framing pending"}</span>
                  <span>{currentShot?.camera ?? "Camera path pending"}</span>
                  <span>{currentShot?.continuityStatus ?? "Continuity pending"}</span>
                </div>
              </div>
              <div className={styles.heroRail}>
                <div className={styles.heroStat}>
                  <small>Narration Cue</small>
                  <b>{currentShot?.narration ?? currentScene?.narration ?? "Narration alignment pending."}</b>
                </div>
                <div className={styles.heroStat}>
                  <small>Asset Route</small>
                  <b>{currentShot?.assetExpectation ?? "No asset route computed yet."}</b>
                </div>
                <div className={styles.heroStat}>
                  <small>Continuity</small>
                  <b>{currentShot?.continuityStatus ?? currentScene?.continuityStatus ?? "Monitoring continuity state."}</b>
                </div>
                <div className={styles.heroStat}>
                  <small>Scene Progress</small>
                  <b>{currentScene ? `${shotIndex || 0}/${currentScene.shots.length} shots active` : "0/0 shots active"}</b>
                </div>
              </div>
            </div>

            <div className={styles.shots}>
              {currentScene?.shots.length ? (
                currentScene.shots.map((shot) => (
                  <button
                    type="button"
                    key={shot.id}
                    className={`${styles.shot} ${currentShot?.id === shot.id ? styles.shotCurrent : ""}`}
                    onClick={() => setSelectedShotId(shot.id)}
                  >
                    <div className={`${styles.thumb} ${styles[`thumb${(shot.number - 1) % 6}`] ?? ""}`}>
                      <span>{String(shot.number).padStart(2, "0")}</span>
                      <b>{shot.title}</b>
                      <div className={styles.screen}>▥ ▤ ▦</div>
                    </div>
                    <small>{formatDuration(shot.durationSeconds)} · {shot.camera}</small>
                    <p>{shot.summary}</p>
                    <div className={styles.shotMeta}>
                      <span>{shot.framing}</span>
                      <span>{shot.assetExpectation}</span>
                    </div>
                    <em>{shot.status === "Planning" ? "● Planning" : "✓ Planned"}</em>
                  </button>
                ))
              ) : (
                <div className={styles.emptyBoard}>No storyboard shots are available until a persisted script version is translated into scenes.</div>
              )}
            </div>

            <div className={styles.timeline}>
              <b>Scene Timeline ({currentScene ? formatDuration(currentScene.durationSeconds) : "00:00"})</b>
              <div className={styles.blocks}>
                {currentScene?.shots.length ? (
                  currentScene.shots.map((shot) => (
                    <i key={shot.id} className={currentShot?.id === shot.id ? styles.blockOn : ""}>
                      {String(shot.number).padStart(2, "0")} · {formatDuration(shot.durationSeconds)}
                    </i>
                  ))
                ) : (
                  <i className={styles.blockPlaceholder}>Awaiting narration-aligned timeline</i>
                )}
              </div>
              <div className={styles.wave}>
                Narration{" "}
                {currentScene?.narration || "Narration alignment will appear here after scene decomposition completes."}
              </div>
            </div>

            <div className={styles.sceneInfo}>
              <section className={styles.panel}>
                <div className={styles.panelTitle}>
                  <h3>Autonomous Action</h3>
                  <span>{content.progress}%</span>
                </div>
                <p className={styles.running}>
                  <Activity size={14} />
                  {content.currentAction}
                </p>
              </section>

              <section className={styles.panel}>
                <div className={styles.panelTitle}>
                  <h3>Expected Visual Assets</h3>
                  <span>{expectedAssets} ASSETS</span>
                </div>
                <p className={styles.infoText}>
                  {content.shotCount} storyboard frames · {content.sceneCount} scene packets · {scenePlannedShots}/{currentScene?.shots.length ?? 0} active scene shots planned
                </p>
              </section>

              <div className={styles.selectedShot}>
                <b>Selected Shot Preview</b>
                <div className={styles.bigScreen}>▥ ▤ ▦</div>
                <div className={styles.selectedShotTags}>
                  <span>{currentShot?.framing ?? "Framing pending"}</span>
                  <span>{currentShot?.camera ?? "Camera pending"}</span>
                  <span>{currentShot?.assetExpectation ?? "Asset pending"}</span>
                </div>
                <span>
                  {currentShot
                    ? `${String(currentShot.number).padStart(2, "0")} · ${currentShot.title} · ${formatDuration(currentShot.durationSeconds)}`
                    : "Waiting for active shot"}
                </span>
                <small>{currentShot?.visualFocus ?? "Storyboard shot details will appear here."}</small>
                <p className={styles.selectedShotNarration}>
                  {currentShot?.narration ?? "Narration alignment for the active shot will appear here after decomposition completes."}
                </p>
              </div>
            </div>

            <div className={styles.revisions}>
              {content.versions.length ? (
                content.versions.slice(0, 3).map((version, index) => (
                  <div className={index === 0 ? styles.revisionActive : ""} key={version.id}>
                    {version.label} · {version.status}
                  </div>
                ))
              ) : (
                <div className={styles.revisionActive}>Storyboard version history will populate after the first planning snapshot.</div>
              )}
            </div>
          </section>

          <div className={styles.bottom}>
            <section className={styles.panel}>
              <div className={styles.panelTitle}>
                <h3>Blockers &amp; Recovery</h3>
                <span>{content.issues.length ? `${content.issues.length} ISSUE` : "HEALTHY"}</span>
              </div>
              {issue ? (
                <>
                  <p className={styles.warningTextLine}>
                    <AlertTriangle size={13} />
                    {issue.title}
                  </p>
                  <p className={styles.okText}>
                    <Check size={12} />
                    {issue.autoFix ?? content.recovery ?? "Autonomous recovery is active."}
                  </p>
                </>
              ) : (
                <p className={styles.okText}>
                  <Check size={12} />
                  {content.recovery ?? "Storyboard package is healthy."}
                </p>
              )}
            </section>

            <section className={styles.panel}>
              <div className={styles.panelTitle}>
                <h3>Production Requirements</h3>
                <span>RESOLVED</span>
              </div>
              <p className={styles.infoText}>
                {content.shotCount} frames · {expectedAssets} total expected assets · {content.brief.aspectRatio} delivery · narration linked
              </p>
            </section>

            <section className={styles.panel}>
              <div className={styles.panelTitle}>
                <h3>Routing Status</h3>
                <span>{content.routing.approved ? "OPEN" : "LOCKED"}</span>
              </div>
              <dl className={styles.compactRows}>
                <dt>Status</dt>
                <dd>{content.routing.status}</dd>
                <dt>Next</dt>
                <dd>{content.routing.visualStudio}</dd>
                <dt>Then</dt>
                <dd>{content.routing.sceneSequencer}</dd>
              </dl>
            </section>
          </div>
        </div>

        <div className={styles.rightColumn}>
          <section className={styles.panel}>
            <div className={styles.panelTitle}>
              <h3>Live Storyboard Agent</h3>
              <span>{adapter.live ? "LIVE API" : "FALLBACK"}</span>
            </div>
            <dl className={styles.compactRows}>
              <dt>Agent</dt>
              <dd>{content.agent.name}</dd>
              <dt>Model</dt>
              <dd>{content.agent.model}</dd>
              <dt>Action</dt>
              <dd>{content.agent.action}</dd>
              <dt>Elapsed</dt>
              <dd>{formatDuration(content.agent.elapsedSeconds)}</dd>
              <dt>Scenes / Shots</dt>
              <dd>{content.sceneCount} / {content.shotCount}</dd>
              <dt>Compute</dt>
              <dd>{content.agent.compute}</dd>
              <dt>Confidence</dt>
              <dd>{content.agent.confidence}</dd>
              <dt>Heartbeat</dt>
              <dd>{content.agent.heartbeat}</dd>
              <dt>Retry Count</dt>
              <dd>{content.agent.retryCount}</dd>
              <dt>Next</dt>
              <dd>{content.agent.nextAction}</dd>
            </dl>
          </section>

          <section className={styles.panel}>
            <div className={styles.panelTitle}>
              <h3>Controlled Routing Rail</h3>
              <span>{content.routing.approved ? "UNLOCKED" : "LOCKED"}</span>
            </div>
            <div className={styles.routeRail}>
              <div className={styles.routeStage}>
                <small>Storyboard Gate</small>
                <strong>{content.routing.status}</strong>
                <span>{content.routing.approved ? "Routing can progress automatically." : "Quality and continuity gates still control release."}</span>
              </div>
              <div className={styles.routeStage}>
                <small>Visual Studio</small>
                <strong>{content.routing.visualStudio}</strong>
                <span>Next controlled handoff after storyboard verification.</span>
              </div>
              <div className={styles.routeStage}>
                <small>Scene Sequencer</small>
                <strong>{content.routing.sceneSequencer}</strong>
                <span>Downstream sequencing stays locked until upstream truth is verified.</span>
              </div>
            </div>
          </section>

          <section className={styles.panel}>
            <div className={styles.panelTitle}>
              <h3>Storyboard Quality &amp; Compliance</h3>
              <span>{content.routing.approved ? "7/7 PASSED" : "ACTIVE"}</span>
            </div>
            <div className={styles.scoreList}>
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
            </div>
            <div className={styles.overall}>
              Truthful score <b>{qualityScore}%</b>
            </div>
          </section>

          <section className={styles.panel}>
            <div className={styles.panelTitle}>
              <h3>Detected Issue</h3>
              <span>{issue ? issue.status : "CLEAR"}</span>
            </div>
            {issue ? (
              <>
                <p className={styles.warningTextLine}>
                  <AlertTriangle size={13} />
                  {issue.title}
                </p>
                <div className={styles.mini}>
                  <i style={{ width: `${content.progress}%` }} />
                </div>
              </>
            ) : (
              <p className={styles.okText}>
                <Check size={12} />
                No active storyboard issue is preventing controlled routing.
              </p>
            )}
          </section>

          <section className={styles.panel}>
            <div className={styles.panelTitle}>
              <h3>Continuity Intelligence</h3>
              <span>MONITORING</span>
            </div>
            <dl className={styles.compactRows}>
              {continuityRows(content).map(([label, value]) => (
                <div className={styles.rowPair} key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className={styles.panel}>
            <div className={styles.panelTitle}>
              <h3>API / SSE Adapter</h3>
              <span>{adapter.mode.toUpperCase()}</span>
            </div>
            <div className={styles.adapterBanner}>
              <i className={adapter.live ? styles.adapterLive : styles.adapterFallback} />
              <span>{adapter.live ? "Event stream synchronized" : "Polling protection active"}</span>
            </div>
            <dl className={styles.compactRows}>
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
          </section>

          <section className={styles.panel}>
            <div className={styles.panelTitle}>
              <h3>Autonomous Decisions (Live)</h3>
              <span>VIEW ALL</span>
            </div>
            <div className={styles.decisionList}>
              {content.decisions.map((decision, index) => (
                <p className={`${styles.decision} ${index === 0 && decision.highlighted ? styles.decisionPrimary : ""}`} key={`${decision.createdAt}-${decision.text}`}>
                  <i />
                  {formatClock(decision.createdAt)} · {decision.text}
                </p>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Check,
  Clock3,
  Headphones,
  LockKeyhole,
  Music4,
  Radio,
  Square,
  Volume2
} from "lucide-react";
import type { MusicPayload, MusicProduction } from "@/lib/music-engine";
import styles from "./AutonomousMusicWorkspace.module.css";

const REFRESH_INTERVAL_MS = 10_000;
const AUTONOMY_INTERVAL_MS = 15_000;
const WORKFLOW_STEPS = [
  "Storyboard validated",
  "Cue map resolved",
  "Composing score",
  "Mastering review",
  "Auto-correction",
  "Timeline ready"
] as const;

async function readApiPayload<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => ({}))) as { message?: string } & T;
  if (!response.ok) {
    throw new Error(payload.message || "The music workspace request failed.");
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

function buildWaitingWorkspace(lastSync: string | null, reason?: string): MusicProduction {
  const updatedAt = lastSync ?? new Date().toISOString();
  return {
    id: "music-waiting",
    code: "QUEUE-WAIT",
    title: "Awaiting music-ready production",
    asset: "Music package pending",
    chapter: "Chapter 01 · Music Handoff",
    stage: "Audio",
    priority: "Medium",
    state: "Waiting for Storyboard",
    step: 0,
    progress: 12,
    updatedAt,
    bpm: 96,
    durationSeconds: 0,
    generatedSeconds: 0,
    cueCount: 0,
    qualityScore: 0,
    brief: {
      purpose: "Claim the next storyboard-backed music package automatically.",
      style: "Cinematic ambient score",
      pacing: "96 BPM target",
      instrumentation: "Pads, piano, light rhythm, subtle bass",
      duration: "00:00",
      delivery: "Underscore / cue bed",
      loudness: "-16 LUFS target"
    },
    governance: {
      originality: "Original composition required",
      copyright: "No unlicensed melodic resemblance",
      voiceConflict: "Protect narration headroom",
      loopPolicy: "No unresolved loop tails",
      mastering: "Integrated loudness enforced",
      export: "WAV master + stem package"
    },
    cues: [],
    stems: [
      { id: "bed", label: "Music Bed", status: "Waiting", ready: false },
      { id: "pulse", label: "Pulse Layer", status: "Waiting", ready: false },
      { id: "transitions", label: "Transitions", status: "Waiting", ready: false },
      { id: "master", label: "Master Print", status: "Waiting", ready: false }
    ],
    waveform: Array.from({ length: 120 }, (_, index) => 16 + ((index * 9) % 42)),
    quality: {
      cueFit: 0,
      dynamics: 0,
      transitions: 0,
      mastering: 0,
      originality: 0,
      narrationSpace: 0,
      safety: 0
    },
    versions: [],
    issues: [
      {
        id: "waiting",
        title: "Music automation is waiting for a storyboard-ready package.",
        detail:
          reason ??
          "The music workspace will not fabricate score output or timeline approval until persisted storyboard timing and a real music render exist.",
        severity: "critical",
        status: "Waiting",
        autoFix: "Continue autonomous polling until storyboard timing is available and the music worker persists output.",
        resolved: false
      }
    ],
    decisions: [
      {
        createdAt: updatedAt,
        text: "The music engine is polling for the next storyboard-backed cue package."
      }
    ],
    agent: {
      name: "Music Agent Beta",
      model: "CACSMS Score Composer v2.1",
      action: "Monitoring storyboard pacing and narration-safe spacing prerequisites.",
      elapsedSeconds: 0,
      generated: "00:00 / 00:00",
      confidence: "Building",
      heartbeat: `Music sync · ${updatedAt}`,
      retryCount: 0,
      nextAction: "Wait for storyboard timing and cue planning inputs.",
      cost: "$0.000"
    },
    routing: {
      status: "Locked pending composed music output and mastering approval",
      next: "Timeline Studio · music bed",
      autoRoute: "Available after mastering and cue-fit gates pass",
      approved: false,
      updatedAt
    },
    adapter: {
      apiEndpoint: "/api/audio/music-generator",
      eventStreamEndpoint: "/api/audio/music-generator/events",
      mode: "polling",
      live: false,
      lastSync: updatedAt,
      detail: "Polling adapter is active. SSE event streaming is reserved until the workspace stream is live."
    },
    recovery: "Continue autonomous polling until storyboard timing and real music output are available.",
    currentAction: "Waiting for storyboard to persist a cue-planning-ready package."
  };
}

export function AutonomousMusicWorkspace({
  initial,
  error
}: {
  initial?: MusicPayload;
  error?: string;
}) {
  const [payload, setPayload] = useState<MusicPayload | undefined>(initial);
  const [requestError, setRequestError] = useState<string | null>(error ?? null);
  const [lastSync, setLastSync] = useState<string | null>(initial?.generatedAt ?? null);
  const [cycleRunning, setCycleRunning] = useState(false);
  const [streamMode, setStreamMode] = useState<"sse" | "polling">("polling");
  const [streamLive, setStreamLive] = useState(false);
  const [adapterDetail, setAdapterDetail] = useState(
    initial?.productions[0]?.adapter.detail ??
      "Polling adapter is active. SSE event streaming is reserved until the workspace stream is live."
  );

  const refresh = useCallback(async () => {
    try {
      const data = await readApiPayload<MusicPayload>(await fetch("/api/audio/music-generator", { cache: "no-store" }));
      setPayload(data);
      setLastSync(data.generatedAt);
      setRequestError(null);
    } catch (refreshError) {
      setRequestError(refreshError instanceof Error ? refreshError.message : "Music workspace refresh failed.");
    }
  }, []);

  const runScheduler = useCallback(async () => {
    setCycleRunning(true);
    try {
      const data = await readApiPayload<MusicPayload>(
        await fetch("/api/audio/music-generator", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "scheduler" })
        })
      );
      setPayload(data);
      setLastSync(data.generatedAt);
      setRequestError(null);
    } catch (schedulerError) {
      setRequestError(schedulerError instanceof Error ? schedulerError.message : "Music scheduler failed.");
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
    const eventSource = new EventSource("/api/audio/music-generator/events");

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as Partial<MusicPayload> & { message?: string };
        if (typeof data.message === "string" && typeof data.generatedAt !== "string") {
          setStreamLive(false);
          setStreamMode("polling");
          setAdapterDetail(data.message);
          return;
        }
        if (typeof data.generatedAt === "string") {
          const nextPayload = data as MusicPayload;
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
        setAdapterDetail("Music SSE payload could not be parsed. Polling fallback is active.");
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
          <div className={styles.kicker}>AUTONOMOUS MUSIC GENERATOR</div>
          <h1>Autonomous Music Generator</h1>
          <p>Storyboard-driven cue planning, composition packaging, mastering review, and timeline routing without manual controls.</p>
        </div>
        <div className={styles.headerStatus}>
          <div className={styles.clockCard}>
            <Clock3 size={15} />
            <span>{formatClock(lastSync)}</span>
            <small>Last sync · {formatTime(lastSync)}</small>
          </div>
          <span className={`${styles.statusPill} ${/ready/i.test(content.state) ? styles.goodPill : styles.warningPill}`}>
            <Music4 size={14} />
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

      <div className={styles.context}>
        <div className={styles.cell}>
          <small>Production</small>
          <b>{content.code}</b>
          <span>{content.title}</span>
        </div>
        <div className={styles.cell}>
          <small>Asset Request</small>
          <b>{content.asset}</b>
          <span>{content.chapter}</span>
        </div>
        <div className={styles.cell}>
          <small>Pipeline Stage</small>
          <b>{content.stage}</b>
        </div>
        <div className={styles.cell}>
          <small>State</small>
          <b className={styles.warningText}>{content.state}</b>
        </div>
        <div className={styles.cell}>
          <small>Priority</small>
          <b>{content.priority}</b>
        </div>
        <div className={styles.cell}>
          <small>Updated</small>
          <b>{formatClock(content.updatedAt)}</b>
          <span>{formatTime(content.updatedAt)}</span>
        </div>
        <button className={styles.contextButton} disabled>
          <LockKeyhole size={13} />
          Approve &amp; Route
          <small>{content.routing.autoRoute}</small>
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

      <div className={styles.grid}>
        <div className={styles.left}>
          <section className={styles.card}>
            <div className={styles.cardTitle}>
              <h3>Persisted Music Brief</h3>
              <span>LOCKED</span>
            </div>
            <dl className={styles.rows}>
              <dt>Purpose</dt>
              <dd>{content.brief.purpose}</dd>
              <dt>Style</dt>
              <dd>{content.brief.style}</dd>
              <dt>Pacing</dt>
              <dd>{content.brief.pacing}</dd>
              <dt>Instrumentation</dt>
              <dd>{content.brief.instrumentation}</dd>
              <dt>Duration</dt>
              <dd>{content.brief.duration}</dd>
              <dt>Delivery</dt>
              <dd>{content.brief.delivery}</dd>
              <dt>Loudness</dt>
              <dd>{content.brief.loudness}</dd>
            </dl>
          </section>

          <section className={styles.card}>
            <div className={styles.cardTitle}>
              <h3>Music Governance</h3>
              <span>COMPLIANT</span>
            </div>
            <dl className={styles.rows}>
              <dt>Originality</dt>
              <dd>{content.governance.originality}</dd>
              <dt>Copyright</dt>
              <dd>{content.governance.copyright}</dd>
              <dt>Voice conflict</dt>
              <dd>{content.governance.voiceConflict}</dd>
              <dt>Loop policy</dt>
              <dd>{content.governance.loopPolicy}</dd>
              <dt>Mastering</dt>
              <dd>{content.governance.mastering}</dd>
              <dt>Export</dt>
              <dd>{content.governance.export}</dd>
            </dl>
          </section>

          <section className={styles.card}>
            <div className={styles.cardTitle}>
              <h3>Cue Map</h3>
              <span>{content.cueCount} CUES</span>
            </div>
            <div className={styles.cueList}>
              {content.cues.length ? (
                content.cues.map((cue, index) => (
                  <p className={styles.cueRow} key={cue.id}>
                    <b>{index + 1}</b>
                    <span>{cue.label}</span>
                    <em>{cue.status}</em>
                    <small>
                      {cue.scene} · {cue.energy} · {formatDuration(cue.durationSeconds)}
                    </small>
                  </p>
                ))
              ) : (
                <div className={styles.emptyState}>Cue map will populate after storyboard timing is available.</div>
              )}
            </div>
          </section>

          <section className={styles.card}>
            <div className={styles.cardTitle}>
              <h3>Stem Package</h3>
              <span>{content.stems.filter((stem) => stem.ready).length}/{content.stems.length} READY</span>
            </div>
            <div className={styles.referenceList}>
              {content.stems.map((stem) => (
                <p className={styles.reference} key={stem.id}>
                  <Radio size={13} />
                  <span>
                    <b>{stem.label}</b>
                    <small>{stem.status}</small>
                  </span>
                  {stem.ready ? <Check size={13} /> : <Square size={13} />}
                </p>
              ))}
            </div>
          </section>
        </div>

        <div className={styles.center}>
          <div className={styles.previewCard}>
            <div className={styles.previewHeader}>
              <b>Music Waveform &amp; Cue Timeline</b>
              <span>Current Cue · Energy · Ducking · Transition · Mastering</span>
              <em>Monitoring</em>
            </div>
            <div className={styles.wavePanel}>
              <div className={styles.ticks}>
                <span>0:00</span>
                <span>0:15</span>
                <span>0:30</span>
                <span>0:45</span>
                <span>1:00</span>
                <span>1:15</span>
                <span>{formatDuration(content.durationSeconds)}</span>
              </div>
              <div className={styles.track}>
                {content.waveform.map((height, index) => (
                  <i className={index > 35 && index < 65 ? styles.hotBar : ""} key={`upper-${index}`} style={{ height: `${height}%` }} />
                ))}
              </div>
              <div className={styles.track}>
                {content.waveform.map((height, index) => (
                  <i className={index > 35 && index < 65 ? styles.hotBar : ""} key={`lower-${index}`} style={{ height: `${Math.max(14, height - 6)}%` }} />
                ))}
              </div>
              <div className={styles.needle} style={{ left: content.durationSeconds ? `${Math.max(8, Math.min(92, (content.generatedSeconds / Math.max(1, content.durationSeconds)) * 100))}%` : "38%" }}>
                <b>{formatDuration(content.generatedSeconds)}</b>
              </div>
              <div className={styles.segmentBadge}>
                {content.cues[1]?.label ?? content.cues[0]?.label ?? "Current cue pending"}
              </div>
            </div>

            <div className={styles.playline}>
              <b>
                {formatDuration(content.generatedSeconds)} / {formatDuration(content.durationSeconds)}
              </b>
              <div>
                <i style={{ width: `${content.durationSeconds ? (content.generatedSeconds / content.durationSeconds) * 100 : 0}%` }} />
              </div>
              <span>{content.bpm} BPM · stem print</span>
            </div>

            <div className={styles.transcript}>
              {content.cues.length ? (
                content.cues.slice(0, 4).map((cue) => (
                  <div key={cue.id}>
                    <time>{formatDuration(cue.durationSeconds)}</time>
                    <span>
                      <b>{cue.label}</b> supports {cue.scene} with {cue.energy.toLowerCase()} energy and {cue.instrumentation.toLowerCase()}.
                    </span>
                  </div>
                ))
              ) : (
                <div className={styles.emptyState}>Cue timeline will appear after storyboard timing is available.</div>
              )}
            </div>

            <div className={styles.takeGrid}>
              {content.versions.slice(0, 4).map((version, index) => (
                <div className={index === 0 ? styles.currentTake : ""} key={version.id}>
                  <b>{version.label}</b>
                  <p>▂▅▃▇▄▂▆▃▅▂▇</p>
                  <span>{version.status}</span>
                  <small>{index === 0 ? "Current package" : "Superseded package"}</small>
                </div>
              ))}
              {!content.versions.length ? (
                <div className={styles.currentTake}>
                  <b>v1.0</b>
                  <p>▂▅▃▇▄▂▆▃▅▂▇</p>
                  <span>Waiting</span>
                  <small>Awaiting first music package</small>
                </div>
              ) : null}
            </div>

            <div className={styles.actionCard}>
              <Activity size={15} />
              <span>
                <small>Current Autonomous Action</small>
                <b>{content.currentAction}</b>
                <em>{issue?.title ?? "Autonomous monitoring is active."}</em>
              </span>
              <strong>{content.progress}%</strong>
            </div>
          </div>

          <div className={styles.bottomGrid}>
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
              ) : null}
            </section>

            <section className={styles.card}>
              <div className={styles.cardTitle}>
                <h3>Music Metadata</h3>
                <span>PERSISTED</span>
              </div>
              <dl className={styles.rows}>
                <dt>BPM</dt>
                <dd>{content.bpm}</dd>
                <dt>Duration</dt>
                <dd>{formatDuration(content.durationSeconds)}</dd>
                <dt>Stems</dt>
                <dd>{content.stems.length}</dd>
                <dt>Mastering</dt>
                <dd>{content.brief.loudness}</dd>
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
                <dt>Auto-route</dt>
                <dd>{content.routing.autoRoute}</dd>
              </dl>
            </section>
          </div>
        </div>

        <div className={styles.right}>
          <section className={styles.card}>
            <div className={styles.cardTitle}>
              <h3>Live Music Agent</h3>
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
              <dt>Generated</dt>
              <dd>{content.agent.generated}</dd>
              <dt>Cost</dt>
              <dd>{content.agent.cost}</dd>
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

          <section className={styles.card}>
            <div className={styles.cardTitle}>
              <h3>Music Quality &amp; Compliance</h3>
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
              Overall truthful score <b>{content.qualityScore}%</b>
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
            ) : null}
          </section>

          <section className={styles.card}>
            <div className={styles.cardTitle}>
              <h3>Version History</h3>
              <span>{content.versions.length} VERSIONS</span>
            </div>
            <div className={styles.versionList}>
              {content.versions.length ? (
                content.versions.map((version, index) => (
                  <p className={styles.versionRow} key={version.id}>
                    <b>{version.label}</b>
                    <span>{version.status}</span>
                    {index === 0 ? <em>Current</em> : null}
                  </p>
                ))
              ) : (
                <div className={styles.emptyState}>Version history will appear after the first music package is persisted.</div>
              )}
            </div>
          </section>

          <section className={styles.card}>
            <div className={styles.cardTitle}>
              <h3>Autonomous Decisions</h3>
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
            {content.decisions.map((decision) => (
              <p className={`${styles.decision} ${decision.highlighted ? styles.decisionPrimary : ""}`} key={`${decision.createdAt}-${decision.text}`}>
                <i />
                {formatClock(decision.createdAt)} · {decision.text}
              </p>
            ))}
          </section>

          <section className={styles.card}>
            <div className={styles.cardTitle}>
              <h3>Output Telemetry</h3>
              <span>MONITORING</span>
            </div>
            <div className={styles.telemetry}>
              <div>
                <Volume2 size={14} />
                <span>
                  <b>Generated</b>
                  <small>{content.agent.generated}</small>
                </span>
              </div>
              <div>
                <Headphones size={14} />
                <span>
                  <b>Cues</b>
                  <small>{content.cueCount}</small>
                </span>
              </div>
              <div>
                <Square size={14} />
                <span>
                  <b>Tempo</b>
                  <small>{content.bpm} BPM</small>
                </span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

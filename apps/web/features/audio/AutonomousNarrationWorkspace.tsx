"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Check,
  Clock3,
  Database,
  Headphones,
  LockKeyhole,
  Radio,
  Square,
  Volume2
} from "lucide-react";
import type { NarrationPayload, NarrationProduction } from "@/lib/narration-engine";
import styles from "./AutonomousNarrationWorkspace.module.css";

const REFRESH_INTERVAL_MS = 10_000;
const AUTONOMY_INTERVAL_MS = 15_000;
const WORKFLOW_STEPS = [
  "Script validated",
  "Voice profile resolved",
  "Synthesizing narration",
  "Audio quality review",
  "Auto-correction",
  "Timeline ready"
] as const;

async function readApiPayload<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => ({}))) as { message?: string } & T;
  if (!response.ok) {
    throw new Error(payload.message || "The narration workspace request failed.");
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

function buildWaitingWorkspace(lastSync: string | null, reason?: string): NarrationProduction {
  const updatedAt = lastSync ?? new Date().toISOString();
  return {
    id: "narration-waiting",
    code: "QUEUE-WAIT",
    title: "Awaiting narration-ready production",
    asset: "Narration package pending",
    chapter: "Chapter 01 · Narration Handoff",
    stage: "Audio",
    priority: "Medium",
    state: "Waiting for Storyboard",
    step: 0,
    progress: 12,
    updatedAt,
    targetWpm: 142,
    totalWords: 0,
    durationSeconds: 0,
    generatedSeconds: 0,
    qualityScore: 0,
    brief: {
      purpose: "Claim the next storyboard-backed narration package automatically.",
      scene: "Waiting for storyboard scene",
      language: "English · Nigeria / International neutral",
      tone: "Authoritative and insightful",
      pace: "142 WPM target",
      duration: "00:00",
      output: "Stereo · 48 kHz / 24-bit",
      voice: "CACSMS Narrator One"
    },
    governance: {
      voiceIdentity: "Waiting for policy-backed voice profile",
      consent: "Pending",
      cloningPolicy: "Enforced",
      impersonation: "Prohibited",
      dictionary: "Awaiting pronunciation dictionary",
      loudness: "-14 LUFS ±1"
    },
    sections: [],
    pronunciations: [],
    transcript: [],
    waveform: Array.from({ length: 120 }, (_, index) => 14 + ((index * 11) % 36)),
    takes: [
      {
        id: "take-awaiting",
        label: "Take 1",
        status: "Waiting",
        detail: "Waiting for the first synthesized narration output.",
        current: true
      }
    ],
    versions: [],
    quality: {
      fidelity: 0,
      pronunciation: 0,
      pacing: 0,
      consistency: 0,
      noise: 0,
      loudness: 0,
      safety: 0
    },
    brandAudio: {
      profile: "CACSMS Narrative",
      reference: "Brand Audio Standard v2.1",
      match: 0,
      spectrum: Array.from({ length: 24 }, (_, index) => 18 + ((index * 7) % 42))
    },
    metadata: {
      fileType: "WAV",
      sampleRate: "48 kHz",
      bitDepth: "24-bit",
      channels: "Stereo",
      loudness: "-14 LUFS"
    },
    issues: [
      {
        id: "waiting",
        title: "Narration automation is waiting for a storyboard-ready package.",
        detail:
          reason ??
          "The narration workspace will not fabricate audio output or timeline approval until persisted storyboard narration and a real audio render exist.",
        severity: "critical",
        status: "Waiting",
        autoFix: "Continue autonomous polling until storyboard narration is available and the audio worker persists output.",
        resolved: false
      }
    ],
    decisions: [
      {
        createdAt: updatedAt,
        text: "The narration engine is polling for the next storyboard-backed narration package."
      }
    ],
    agent: {
      name: "Audio Agent Alpha",
      model: "CACSMS Voice Synthesis v2.4",
      voice: "CACSMS Narrator One",
      action: "Monitoring storyboard and narration prerequisites.",
      elapsedSeconds: 0,
      generated: "00:00 / 00:00",
      cost: "$0.000",
      confidence: "Building",
      heartbeat: `Narration sync · ${updatedAt}`,
      retryCount: 0,
      nextAction: "Wait for storyboard narration and package synthesis inputs."
    },
    routing: {
      status: "Locked pending synthesized audio output and quality approval",
      next: "Timeline Studio · narration track",
      autoRoute: "Available after audio quality gates pass",
      approved: false,
      updatedAt
    },
    adapter: {
      apiEndpoint: "/api/audio/narration-generator",
      eventStreamEndpoint: "/api/audio/narration-generator/events",
      mode: "polling",
      live: false,
      lastSync: updatedAt,
      detail: "Polling adapter is active. SSE event streaming is reserved until the workspace stream is live."
    },
    recovery: "Continue autonomous polling until storyboard narration and real audio output are available.",
    currentAction: "Waiting for storyboard to persist a narration-ready package."
  };
}

export function AutonomousNarrationWorkspace({
  initial,
  error
}: {
  initial?: NarrationPayload;
  error?: string;
}) {
  const [payload, setPayload] = useState<NarrationPayload | undefined>(initial);
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
      const data = await readApiPayload<NarrationPayload>(await fetch("/api/audio/narration-generator", { cache: "no-store" }));
      setPayload(data);
      setLastSync(data.generatedAt);
      setRequestError(null);
    } catch (refreshError) {
      setRequestError(refreshError instanceof Error ? refreshError.message : "Narration workspace refresh failed.");
    }
  }, []);

  const runScheduler = useCallback(async () => {
    setCycleRunning(true);
    try {
      const data = await readApiPayload<NarrationPayload>(
        await fetch("/api/audio/narration-generator", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "scheduler" })
        })
      );
      setPayload(data);
      setLastSync(data.generatedAt);
      setRequestError(null);
    } catch (schedulerError) {
      setRequestError(schedulerError instanceof Error ? schedulerError.message : "Narration scheduler failed.");
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
    const eventSource = new EventSource("/api/audio/narration-generator/events");

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as Partial<NarrationPayload> & { message?: string };

        if (typeof data.message === "string" && typeof data.generatedAt !== "string") {
          setStreamLive(false);
          setStreamMode("polling");
          setAdapterDetail(data.message);
          return;
        }

        if (typeof data.generatedAt === "string") {
          const nextPayload = data as NarrationPayload;
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
        setAdapterDetail("Narration SSE payload could not be parsed. Polling fallback is active.");
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
  const currentSegment = content.transcript.find((segment) => segment.current) ?? content.transcript[0] ?? null;

  return (
    <div className={styles.page}>
      <div className={styles.headerShell}>
        <div>
          <div className={styles.kicker}>AUTONOMOUS NARRATION GENERATOR</div>
          <h1>Autonomous Narration Generator</h1>
          <p>Script-driven voice synthesis, pronunciation validation, mastering, and timeline routing without manual controls.</p>
        </div>
        <div className={styles.headerStatus}>
          <div className={styles.clockCard}>
            <Clock3 size={15} />
            <span>{formatClock(lastSync)}</span>
            <small>Last sync · {formatTime(lastSync)}</small>
          </div>
          <span className={`${styles.statusPill} ${/ready/i.test(content.state) ? styles.goodPill : styles.warningPill}`}>
            <Headphones size={14} />
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
          <span>Narration gates are healthy and routing remains controlled by persisted audio output and QA state.</span>
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
              <h3>Persisted Narration Brief</h3>
              <span>LOCKED</span>
            </div>
            <dl className={styles.rows}>
              <dt>Purpose</dt>
              <dd>{content.brief.purpose}</dd>
              <dt>Scene</dt>
              <dd>{content.brief.scene}</dd>
              <dt>Language</dt>
              <dd>{content.brief.language}</dd>
              <dt>Tone</dt>
              <dd>{content.brief.tone}</dd>
              <dt>Pace</dt>
              <dd>{content.brief.pace}</dd>
              <dt>Duration</dt>
              <dd>{content.brief.duration}</dd>
              <dt>Output</dt>
              <dd>{content.brief.output}</dd>
              <dt>Voice</dt>
              <dd>{content.brief.voice}</dd>
            </dl>
          </section>

          <section className={styles.card}>
            <div className={styles.cardTitle}>
              <h3>Voice Governance</h3>
              <span>COMPLIANT</span>
            </div>
            <dl className={styles.rows}>
              <dt>Voice identity</dt>
              <dd>{content.governance.voiceIdentity}</dd>
              <dt>Consent</dt>
              <dd>{content.governance.consent}</dd>
              <dt>Cloning policy</dt>
              <dd>{content.governance.cloningPolicy}</dd>
              <dt>Impersonation</dt>
              <dd>{content.governance.impersonation}</dd>
              <dt>Dictionary</dt>
              <dd>{content.governance.dictionary}</dd>
              <dt>Loudness</dt>
              <dd>{content.governance.loudness}</dd>
            </dl>
          </section>

          <section className={styles.card}>
            <div className={styles.cardTitle}>
              <h3>Script Sections</h3>
              <span>{content.totalWords} WORDS</span>
            </div>
            <div className={styles.sectionList}>
              {content.sections.length ? (
                content.sections.map((section, index) => (
                  <p className={styles.sectionRow} key={section.id}>
                    <b>{index + 1}</b>
                    <span>{section.label}</span>
                    <em>{section.status}</em>
                    <small>
                      {section.wordCount} words · {formatDuration(section.durationSeconds)}
                    </small>
                  </p>
                ))
              ) : (
                <div className={styles.emptyState}>Sections will populate after storyboard narration is available.</div>
              )}
            </div>
          </section>

          <section className={styles.card}>
            <div className={styles.cardTitle}>
              <h3>Pronunciation &amp; Evidence</h3>
              <span>{content.pronunciations.length ? "VERIFIED" : "WAITING"}</span>
            </div>
            <div className={styles.referenceList}>
              {content.pronunciations.length ? (
                content.pronunciations.map((entry) => (
                  <p className={styles.reference} key={entry.id}>
                    <Radio size={13} />
                    <span>
                      <b>{entry.term}</b>
                      <small>
                        {entry.spokenForm} · {entry.source}
                      </small>
                    </span>
                    <Check size={13} />
                  </p>
                ))
              ) : (
                <div className={styles.emptyState}>Pronunciation evidence will load from the narration package.</div>
              )}
            </div>
          </section>

          <section className={styles.card}>
            <div className={styles.cardTitle}>
              <h3>Brand Audio Profile</h3>
              <span>{content.brandAudio.match}% MATCH</span>
            </div>
            <div className={styles.equalizer}>
              {content.brandAudio.spectrum.map((level, index) => (
                <i key={`${index}-${level}`} style={{ height: `${level}%` }} />
              ))}
            </div>
            <dl className={styles.rows}>
              <dt>Profile</dt>
              <dd>{content.brandAudio.profile}</dd>
              <dt>Reference</dt>
              <dd>{content.brandAudio.reference}</dd>
            </dl>
          </section>
        </div>

        <div className={styles.center}>
          <div className={styles.previewCard}>
            <div className={styles.previewHeader}>
              <b>Narration Waveform &amp; Timeline</b>
              <span>Current Segment · Silence · Breathing · Emphasis · Pronunciation</span>
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
                  <i
                    className={index > 35 && index < 65 ? styles.hotBar : ""}
                    key={`upper-${index}`}
                    style={{ height: `${height}%` }}
                  />
                ))}
              </div>
              <div className={styles.track}>
                {content.waveform.map((height, index) => (
                  <i
                    className={index > 35 && index < 65 ? styles.hotBar : ""}
                    key={`lower-${index}`}
                    style={{ height: `${Math.max(16, height - 4)}%` }}
                  />
                ))}
              </div>
              <div className={styles.needle} style={{ left: currentSegment ? `${Math.min(92, Math.max(8, (currentSegment.startSeconds / Math.max(1, content.durationSeconds)) * 100))}%` : "38%" }}>
                <b>{currentSegment ? formatDuration(currentSegment.startSeconds) : "00:00"}</b>
              </div>
              <div className={styles.segmentBadge}>
                {currentSegment ? `Current segment · ${currentSegment.label}` : "Waiting for current segment"}
              </div>
            </div>

            <div className={styles.playline}>
              <b>
                {formatDuration(content.generatedSeconds)} / {formatDuration(content.durationSeconds)}
              </b>
              <div>
                <i style={{ width: `${content.durationSeconds ? (content.generatedSeconds / content.durationSeconds) * 100 : 0}%` }} />
              </div>
              <span>{content.metadata.sampleRate} · {content.metadata.bitDepth}</span>
            </div>

            <div className={styles.transcript}>
              {content.transcript.length ? (
                content.transcript.slice(0, 4).map((segment) => (
                  <div className={segment.current ? styles.activeTranscript : ""} key={segment.id}>
                    <time>{formatDuration(segment.startSeconds)}</time>
                    <span>
                      {segment.emphasis ? (
                        <>
                          {segment.text.split(segment.emphasis)[0]}
                          <mark>{segment.emphasis}</mark>
                          {segment.text.split(segment.emphasis)[1] ?? ""}
                        </>
                      ) : (
                        segment.text
                      )}
                    </span>
                  </div>
                ))
              ) : (
                <div className={styles.emptyState}>Transcript timing will appear after storyboard narration is available.</div>
              )}
            </div>

            <div className={styles.takeGrid}>
              {content.takes.map((take) => (
                <div className={take.current ? styles.currentTake : ""} key={take.id}>
                  <b>{take.label}</b>
                  <p>▂▅▃▇▄▂▆▃▅▂▇</p>
                  <span>{take.status}</span>
                  <small>{take.detail}</small>
                </div>
              ))}
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
              ) : (
                <p className={styles.ok}>
                  <Check size={12} />
                  {content.recovery ?? "Narration package is healthy."}
                </p>
              )}
            </section>

            <section className={styles.card}>
              <div className={styles.cardTitle}>
                <h3>Audio Metadata</h3>
                <span>PERSISTED</span>
              </div>
              <dl className={styles.rows}>
                <dt>File type</dt>
                <dd>{content.metadata.fileType}</dd>
                <dt>Sample rate</dt>
                <dd>{content.metadata.sampleRate}</dd>
                <dt>Bit depth</dt>
                <dd>{content.metadata.bitDepth}</dd>
                <dt>Channels</dt>
                <dd>{content.metadata.channels}</dd>
                <dt>Loudness</dt>
                <dd>{content.metadata.loudness}</dd>
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
              <h3>Live Narration Agent</h3>
              <span>{adapter.live ? "LIVE API" : "PREVIEW MODE"}</span>
            </div>
            <dl className={styles.rows}>
              <dt>Agent</dt>
              <dd>{content.agent.name}</dd>
              <dt>Model</dt>
              <dd>{content.agent.model}</dd>
              <dt>Voice</dt>
              <dd>{content.agent.voice}</dd>
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
              <h3>Audio Quality &amp; Compliance</h3>
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
            ) : (
              <p className={styles.ok}>
                <Check size={12} />
                No active narration issue is preventing controlled routing.
              </p>
            )}
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
                <div className={styles.emptyState}>Version history will appear after the first narration package is persisted.</div>
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
                <Database size={14} />
                <span>
                  <b>Total Words</b>
                  <small>{content.totalWords}</small>
                </span>
              </div>
              <div>
                <Square size={14} />
                <span>
                  <b>Target Pace</b>
                  <small>{content.targetWpm} WPM</small>
                </span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

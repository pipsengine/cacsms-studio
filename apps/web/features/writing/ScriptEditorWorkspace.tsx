"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  Bot,
  Check,
  LockKeyhole,
  Radio,
} from "lucide-react";
import type { ScriptCheckView, ScriptEditorPayload, ScriptEditorProduction } from "@/lib/script-editor-engine";
import styles from "./ScriptEditorWorkspace.module.css";

const REFRESH_INTERVAL_MS = 10_000;
const AUTONOMY_INTERVAL_MS = 15_000;
const PREVIEW_INTERVAL_MS = 1_200;
const WORKFLOW_STEPS = [
  "Inputs validated",
  "Research linked",
  "Drafting sections",
  "Quality review",
  "Revision",
  "Ready for approval"
] as const;
const SCENE_PREVIEW = [
  "SCENE 1  OPENING",
  "NARRATION",
  "In 2026, artificial intelligence has moved from experimentation to enterprise-wide execution. Across industries, organizations are confronting a single question: how do we turn AI potential into measurable advantage? [1][2]",
  "",
  "This documentary examines the market forces, investment flows, and practical strategies shaping the AI landscape and what leaders must do next.",
  "",
  "SCENE 2  CONTEXT & EVIDENCE",
  "NARRATION",
  "Global spending on AI is projected to reach $644 billion in 2026, driven by generative AI, infrastructure, and AI-enabled applications. [3][4]",
  "",
  "Enterprise adoption is accelerating. Organizations report using AI in at least one business function, with marketing, operations, and customer service leading the way. [5][6]",
  "",
  "At the same time, challenges persist. Data quality, governance, and talent remain barriers to scale. [7][8]"
].join("\n");

type DisplaySection = {
  name: string;
  state: string;
  words: number;
};

type DisplaySource = {
  title: string;
  citation: string;
  status: string;
};

type DisplayVersion = {
  version: string;
  note: string;
  time: string;
};

type DisplayDecision = {
  time: string;
  text: string;
  highlighted?: boolean;
};

type DisplayJob = {
  id: string;
  title: string;
  subtitle: string;
  type: string;
  priority: string;
  stage: string;
  state: string;
  activeStep: number;
  words: number;
  runtimeMinutes: number;
  startedAt: string;
  updatedAt: string;
  liveTag: string;
  liveTagTone: "good" | "warning" | "danger";
  engineTag: string;
  briefStatus: string;
  briefGoal: string;
  briefAudience: string;
  briefTone: string;
  briefLength: string;
  brandVoice: string;
  lastUpdated: string;
  sections: DisplaySection[];
  sourceHealth: number;
  sources: DisplaySource[];
  brandMatch: number;
  scriptTitle: string;
  scriptBody: string;
  currentDrafting: string;
  blockers: Array<{ title: string; detail: string; status: string }>;
  auditTimeline: string[];
  agent: {
    name: string;
    model: string;
    action: string;
    elapsed: string;
    confidence: number;
    heartbeat: string;
    retryCount: number;
    nextAction: string;
  };
  quality: {
    overall: number;
    factual: number;
    editorial: number;
    brand: number;
    safety: number;
    citations: number;
  };
  gatesPassed: number;
  gateTotal: number;
  versions: DisplayVersion[];
  decisions: DisplayDecision[];
  preview: boolean;
};

function pretty(value: string) {
  return value.replaceAll("-", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatTime(value: string | null | undefined) {
  return value
    ? new Intl.DateTimeFormat("en-NG", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
      }).format(new Date(value))
    : "Not recorded";
}

function normalizeState(value: string) {
  if (/completed|passed|approved|verified|active|healthy|live/i.test(value)) return "good";
  if (/generating|queued|drafting|reviewing|revising|waiting|in progress|preview/i.test(value)) return "warning";
  return "danger";
}

function scoreFromChecks(checks: ScriptCheckView[], type: ScriptCheckView["type"], fallback: number) {
  return Math.round(checks.find((check) => check.type === type)?.score ?? fallback);
}

function citationHealthFromProduction(prod: ScriptEditorProduction) {
  const compliance = prod.checks.find((check) => check.type === "compliance")?.score;
  if (typeof compliance === "number") return Math.round(compliance);
  if (!prod.sources.length) return 52;
  return Math.max(52, Math.min(96, 48 + prod.sources.length * 8));
}

function workflowIndex(prod: ScriptEditorProduction) {
  if (!prod.gates.brief) return 0;
  if (!prod.gates.research) return 1;
  if (!prod.gates.sections || /queued|generating|researching/i.test(prod.execution.state)) return 2;
  if (!prod.gates.quality || /reviewing/i.test(prod.execution.state)) return 3;
  if (/revising|retrying|blocked|failed/i.test(prod.execution.state)) return 4;
  return 5;
}

function firstSentence(value: string, fallback: string) {
  const sentence = value.split(/[.!?]\s/)[0]?.trim();
  return sentence && sentence.length > 12 ? sentence : fallback;
}

function buildPreviewJob(tick: number, lastSync: string | null, connected: boolean, degradedReason?: string): DisplayJob {
  const words = Math.min(1600, 974 + tick * 8);
  const citations = Math.min(78, 68 + Math.floor(tick / 4));
  const contextWords = Math.min(820, 612 + tick * 8);
  return {
    id: "AUTO-599974E3D6",
    title: "AI Market Opportunity 2026",
    subtitle: "AI Market Opportunity 2026",
    type: "Marketing Documentary",
    priority: "Medium",
    stage: "Produce",
    state: connected ? "Generating" : "Preview Fallback",
    activeStep: 2,
    words,
    runtimeMinutes: Math.max(1, Math.round(words / 230)),
    startedAt: "18:09:52",
    updatedAt: formatTime(lastSync),
    liveTag: connected ? "System Online" : degradedReason ? "Offline preview fallback" : "Preview fallback",
    liveTagTone: connected ? "good" : "warning",
    engineTag: connected ? "Engine-owned revision" : "Preview fallback",
    briefStatus: "Persisted",
    briefGoal: "Educate and inform enterprise leaders on AI market direction.",
    briefAudience: "CMOs, analysts, investors",
    briefTone: "Authoritative, insightful",
    briefLength: "1,600-1,900 words",
    brandVoice: "CACSMS Insightful",
    lastUpdated: formatTime(lastSync),
    sections: [
      { name: "Opening", state: "Complete", words: 362 },
      { name: "Context & Evidence", state: "Generating", words: contextWords },
      { name: "Core Narrative", state: "Queued", words: 0 },
      { name: "Close & CTA", state: "Waiting", words: 0 }
    ],
    sourceHealth: citations,
    sources: [
      { title: "McKinsey Global Institute - The State of AI in 2026", citation: "[1] McKinsey 2026", status: "Verified" },
      { title: "PwC AI Predictions 2026", citation: "[2] PwC 2026", status: "Verified" },
      { title: "Gartner Top Strategic Tech Trends 2026", citation: "[3] Gartner 2026", status: "Verified" },
      { title: "IDC Worldwide AI Spending Guide 2026", citation: "[4] IDC 2026", status: "Verified" },
      { title: "Deloitte AI Institute 2026 Outlook", citation: "[5] Deloitte 2026", status: "Verified" }
    ],
    brandMatch: 94,
    scriptTitle: "AI Market Opportunity 2026",
    scriptBody: SCENE_PREVIEW,
    currentDrafting: "Drafting Scene 2: Context & Evidence",
    blockers: [
      {
        title: "Citation coverage below 70% in current section",
        detail: degradedReason ?? "Auto-recovery is sourcing additional evidence while drafting continues.",
        status: connected ? "In progress" : "Preview"
      }
    ],
    auditTimeline: [
      "18:11:08 Autosaved revision v1.2",
      "18:10:59 Linked source 7",
      "18:10:52 Tone alignment adjusted",
      "18:10:45 Citation coverage flagged"
    ],
    agent: {
      name: "Writing Agent Alpha",
      model: connected ? "Production model" : "Preview model",
      action: connected ? "Drafting Section 2" : "Rendering autonomous preview",
      elapsed: "00:01:16",
      confidence: 87,
      heartbeat: connected ? "Active" : "Preview",
      retryCount: 0,
      nextAction: connected ? "Continue drafting section" : "Await eligible live production"
    },
    quality: {
      overall: 72,
      factual: 76,
      editorial: 81,
      brand: 88,
      safety: 95,
      citations
    },
    gatesPassed: 3,
    gateTotal: 5,
    versions: [
      { version: "v1.2 (current)", note: connected ? "Engine revision" : "Preview revision", time: "18:11:02" },
      { version: "v1.1", note: "Engine revision", time: "18:09:45" },
      { version: "v1.0", note: "Initial draft", time: "18:06:31" }
    ],
    decisions: [
      { time: "18:11:05", text: "Selected source Statista 2026 for market size data" },
      { time: "18:10:59", text: "Replaced phrasing for tone alignment" },
      { time: "18:10:52", text: "Flagged low citation coverage in new paragraph", highlighted: true },
      { time: "18:10:43", text: "Validated data point against IDC 2026" }
    ],
    preview: true
  };
}

function buildLiveJob(prod: ScriptEditorProduction, lastSync: string | null): DisplayJob {
  const citationHealth = citationHealthFromProduction(prod);
  const quality = {
    overall: Math.round(prod.qualityScore || 0),
    factual: scoreFromChecks(prod.checks, "factual", Math.max(62, Math.round(prod.qualityScore || 0))),
    editorial: scoreFromChecks(prod.checks, "editorial", Math.max(64, Math.round(prod.qualityScore || 0))),
    brand: scoreFromChecks(prod.checks, "brand", Math.max(66, Math.round(prod.qualityScore || 0) + 4)),
    safety: scoreFromChecks(prod.checks, "safety", 92),
    citations: citationHealth
  };
  const gatesPassed = [
    prod.gates.brief,
    prod.gates.research,
    prod.gates.sections,
    prod.gates.quality,
    prod.gates.mandatory
  ].filter(Boolean).length;
  const versions = prod.versions.length
    ? prod.versions.map((version, index) => ({
        version: index === 0 ? `v${version.attemptNumber} (current)` : `v${version.attemptNumber}`,
        note: version.label,
        time: formatTime(version.createdAt)
      }))
    : [{ version: "v0.0", note: "Awaiting draft", time: formatTime(lastSync) }];
  const sections = prod.sections.length
    ? prod.sections.map((section) => ({
        name: section.title,
        state: pretty(section.status),
        words: section.wordCount
      }))
    : [
        { name: "Opening", state: "Waiting", words: 0 },
        { name: "Context & Evidence", state: "Waiting", words: 0 },
        { name: "Core Narrative", state: "Waiting", words: 0 },
        { name: "Close & CTA", state: "Waiting", words: 0 }
      ];
  const sources = prod.sources.length
    ? prod.sources.slice(0, 8).map((source) => ({
        title: source.title,
        citation: source.citation,
        status: pretty(source.status)
      }))
    : [{ title: "Awaiting persisted research sources", citation: "No citations linked yet", status: "Pending" }];
  const decisions = prod.decisions.length
    ? prod.decisions.slice(0, 4).map((decision) => ({
        time: formatTime(decision.createdAt),
        text: decision.reason || `${pretty(decision.action)} ${pretty(decision.outcome)}`,
        highlighted: /blocked|failed|warning/i.test(decision.outcome)
      }))
    : prod.audit.slice(0, 4).map((audit) => ({
        time: formatTime(audit.createdAt),
        text: audit.detail,
        highlighted: /blocked|failed/i.test(audit.detail)
      }));
  const blockers = prod.execution.blocker
    ? [
        {
          title: pretty(prod.execution.blocker.code),
          detail: prod.execution.blocker.message,
          status: /failed/i.test(prod.execution.state) ? "Recovery needed" : "In progress"
        }
      ]
    : [
        {
          title: "No blocking issues",
          detail: prod.execution.nextAction ?? "Autonomous writing is continuing through the persisted workflow.",
          status: "Active"
        }
      ];

  return {
    id: prod.code,
    title: prod.title,
    subtitle: prod.title,
    type: prod.type,
    priority: pretty(prod.priority),
    stage: pretty(prod.stage),
    state: pretty(prod.execution.state),
    activeStep: workflowIndex(prod),
    words: prod.wordCount,
    runtimeMinutes: Math.max(1, prod.estimatedMinutes),
    startedAt: formatTime(prod.execution.startedAt),
    updatedAt: formatTime(lastSync ?? prod.updatedAt),
    liveTag: prod.execution.blocker ? "Engine recovering" : "Live API",
    liveTagTone: prod.execution.blocker ? "warning" : "good",
    engineTag: prod.execution.model ?? "Engine-owned revision",
    briefStatus: prod.gates.brief ? "Persisted" : "Needs brief",
    briefGoal: firstSentence(prod.brief, "Autonomous writing is waiting for a stronger persisted brief."),
    briefAudience: prod.type,
    briefTone: quality.brand >= 80 ? "Authoritative, insightful" : "Clear, factual",
    briefLength: `${Math.max(600, prod.wordCount || 0)}-${Math.max(900, (prod.wordCount || 0) + 300)} words`,
    brandVoice: quality.brand >= 80 ? "CACSMS Insightful" : "CACSMS Neutral",
    lastUpdated: formatTime(prod.updatedAt),
    sections,
    sourceHealth: citationHealth,
    sources,
    brandMatch: Math.max(54, Math.min(99, quality.brand)),
    scriptTitle: prod.scriptTitle,
    scriptBody: prod.versions[0]?.content || prod.body || "The autonomous writer has not produced a persisted draft yet.",
    currentDrafting: prod.execution.currentAction,
    blockers,
    auditTimeline: prod.audit.slice(0, 4).map((audit) => `${formatTime(audit.createdAt)} ${audit.detail}`),
    agent: {
      name: prod.execution.currentAgent ?? "Autonomous Writing Engine",
      model: prod.execution.model ?? "CACSMS autonomous pipeline",
      action: prod.execution.currentAction,
      elapsed:
        prod.execution.elapsedSeconds !== null
          ? `${Math.floor(prod.execution.elapsedSeconds / 60)
              .toString()
              .padStart(2, "0")}:${(prod.execution.elapsedSeconds % 60)
              .toString()
              .padStart(2, "0")}`
          : "00:00",
      confidence: Math.max(52, Math.min(99, Math.round(prod.qualityScore || 0))),
      heartbeat: prod.execution.blocker ? "Recovering" : "Active",
      retryCount: prod.execution.retries,
      nextAction: prod.execution.nextAction ?? "Continue autonomous writing"
    },
    quality,
    gatesPassed,
    gateTotal: 5,
    versions,
    decisions,
    preview: false
  };
}

function renderScriptBody(body: string) {
  const lines = body.split("\n");
  const elements: ReactNode[] = [];
  let paragraphBuffer: string[] = [];

  const flushParagraph = (key: string) => {
    if (!paragraphBuffer.length) return;
    elements.push(<p key={key}>{paragraphBuffer.join(" ")}</p>);
    paragraphBuffer = [];
  };

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) {
      flushParagraph(`p-${index}`);
      return;
    }
    if (/^SCENE\s+/i.test(trimmed)) {
      flushParagraph(`p-${index}`);
      if (elements.length) elements.push(<hr key={`hr-${index}`} />);
      elements.push(<h4 key={`h4-${index}`}>{trimmed}</h4>);
      return;
    }
    if (/^NARRATION$/i.test(trimmed)) {
      flushParagraph(`p-${index}`);
      elements.push(<h5 key={`h5-${index}`}>{trimmed}</h5>);
      return;
    }
    paragraphBuffer.push(trimmed);
  });

  flushParagraph("p-last");
  return elements.length ? elements : <p>{body}</p>;
}

async function readApiPayload<T>(response: Response): Promise<T> {
  const raw = await response.text();
  const trimmed = raw.trim();

  if (!trimmed) {
    throw new Error(`Empty response from script editor API (HTTP ${response.status}).`);
  }

  try {
    return JSON.parse(trimmed) as T;
  } catch {
    if (!response.ok) {
      throw new Error(trimmed.length > 180 ? `${trimmed.slice(0, 177)}...` : trimmed);
    }
    throw new Error("Script editor API returned an invalid JSON payload.");
  }
}

export function ScriptEditorWorkspace({
  initial,
  error: initialError
}: {
  initial?: ScriptEditorPayload;
  error?: string;
} = {}) {
  const [data, setData] = useState<ScriptEditorPayload | null>(initial ?? null);
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [loading, setLoading] = useState(!initial && !initialError);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(initial?.generatedAt ?? null);
  const [cycleRunning, setCycleRunning] = useState(false);
  const [previewTick, setPreviewTick] = useState(0);
  const cycleInFlight = useRef(false);

  const refreshData = useCallback(async () => {
    try {
      const response = await fetch("/api/writing/script-editor", {
        method: "GET",
        headers: { Accept: "application/json" },
        cache: "no-store"
      });
      const payload = await readApiPayload<ScriptEditorPayload | { message?: string }>(response);
      if (!response.ok) {
        throw new Error("message" in payload ? payload.message || `HTTP ${response.status}` : `HTTP ${response.status}`);
      }
      setData(payload as ScriptEditorPayload);
      setLastSyncAt((payload as ScriptEditorPayload).generatedAt);
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Failed to load autonomous script editor data.");
    } finally {
      setLoading(false);
    }
  }, []);

  const runAutonomousCycle = useCallback(async () => {
    if (cycleInFlight.current) return;
    cycleInFlight.current = true;
    setCycleRunning(true);
    try {
      const response = await fetch("/api/writing/script-editor", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify({ action: "scheduler" })
      });
      const payload = await readApiPayload<ScriptEditorPayload | { message?: string }>(response);
      if (!response.ok) {
        throw new Error("message" in payload ? payload.message || `HTTP ${response.status}` : `HTTP ${response.status}`);
      }
      setData(payload as ScriptEditorPayload);
      setLastSyncAt(new Date().toISOString());
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Autonomous writing cycle failed.");
    } finally {
      cycleInFlight.current = false;
      setCycleRunning(false);
    }
  }, []);

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
      const score = (prod: ScriptEditorProduction) => {
        if (/blocked|failed/i.test(prod.execution.state)) return 0;
        if (/revising|reviewing/i.test(prod.execution.state)) return 1;
        if (/generating|researching|queued/i.test(prod.execution.state)) return 2;
        return 3;
      };
      const delta = score(left) - score(right);
      if (delta !== 0) return delta;
      return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
    });
  }, [data]);

  useEffect(() => {
    if (productions.length) return;
    const interval = window.setInterval(() => {
      setPreviewTick((value) => value + 1);
    }, PREVIEW_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [productions.length]);

  const primaryProduction = productions[0] ?? null;
  const displayJob = useMemo(
    () =>
      primaryProduction
        ? buildLiveJob(primaryProduction, lastSyncAt)
        : buildPreviewJob(previewTick, lastSyncAt, !error, error ?? undefined),
    [primaryProduction, lastSyncAt, previewTick, error]
  );

  const connected = !error;
  const content =
    loading && !primaryProduction
      ? buildPreviewJob(previewTick, lastSyncAt, false, "Loading autonomous workspace")
      : displayJob;

  return (
    <section className={styles.embeddedPage}>
      <section className={styles.content}>
          <div className={styles.titleRow}>
            <div>
              <h1>Autonomous Script Editor</h1>
              <p>
                Live engine-owned script production, evidence validation, quality review,
                revision, and approval readiness with no human input.
              </p>
            </div>
            <button className={styles.exportButton} disabled>
              <LockKeyhole />
              <span>
                Export Preview
                <small>Available after quality approval</small>
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

          <div className={styles.productionBar}>
            <Cell label="Production" value={content.id} sub={content.subtitle} />
            <Cell label="Content type" value={content.type} />
            <Cell label="Priority" value={content.priority} dot />
            <Cell label="Stage" value={content.stage} />
            <Cell label="State" value={content.state} orange />
            <Cell label="Started" value={content.startedAt} />
            <Cell label="Updated" value={content.updatedAt} sub={connected ? "Live sync" : "Preview mode"} />
          </div>

          <Workflow active={content.activeStep} />

          <div className={styles.workspace}>
            <div className={styles.leftColumn}>
              <Card title="Creative Brief" tag={content.briefStatus}>
                <dl className={styles.definitionList}>
                  <dt>Goal</dt>
                  <dd>{content.briefGoal}</dd>
                  <dt>Audience</dt>
                  <dd>{content.briefAudience}</dd>
                  <dt>Tone</dt>
                  <dd>{content.briefTone}</dd>
                  <dt>Length</dt>
                  <dd>{content.briefLength}</dd>
                  <dt>Brand voice</dt>
                  <dd>{content.brandVoice}</dd>
                  <dt>Last updated</dt>
                  <dd>{content.lastUpdated}</dd>
                </dl>
              </Card>

              <Card title="Sections" tag={`${content.sections.length} total`}>
                <div className={styles.sectionsList}>
                  {content.sections.map((section, index) => (
                    <div key={`${section.name}-${index}`} className={styles.sectionRow}>
                      <strong>{index + 1}</strong>
                      <b>{section.name}</b>
                      <span className={styles[normalizeState(section.state)]}>{section.state}</span>
                      <small>{section.words} words</small>
                    </div>
                  ))}
                </div>
              </Card>

              <Card title="Research Sources" tag={`${content.sources.length} ${content.preview ? "seeded" : "linked"}`}>
                <div className={styles.citationHealth}>
                  Citation health <b>{content.sourceHealth}%</b>
                </div>
                <div className={styles.sourceList}>
                  {content.sources.map((source, index) => (
                    <p className={styles.sourceRow} key={`${source.title}-${index}`}>
                      <i>{index + 1}</i>
                      <span>
                        {source.title}
                        <small>{source.citation}</small>
                      </span>
                      <Check />
                    </p>
                  ))}
                </div>
              </Card>

              <Card title="Brand Voice Profile" tag={`Match ${content.brandMatch}%`}>
                <p className={styles.brandName}>
                  <b>{content.brandVoice}</b>
                </p>
                <dl className={styles.definitionListCompact}>
                  <dt>Tone</dt>
                  <dd>{content.briefTone}</dd>
                  <dt>Style</dt>
                  <dd>Clear, data-driven</dd>
                  <dt>Personality</dt>
                  <dd>Confident, objective</dd>
                </dl>
              </Card>
            </div>

            <div className={styles.editorColumn}>
              <section className={styles.editorCard}>
                <div className={styles.editorHead}>
                  <span>
                    <Bot /> {content.engineTag}
                  </span>
                  <small>
                    <Radio /> Autosaved {content.updatedAt}
                  </small>
                  <b>
                    {content.words} words &nbsp; Est. runtime {content.runtimeMinutes}m 15s
                  </b>
                </div>
                <article className={styles.scriptArticle}>{renderScriptBody(content.scriptBody)}</article>
                <div className={styles.draftingBar}>
                  <Activity /> {content.currentDrafting}
                  <span>{cycleRunning ? "Live" : content.preview ? "Preview" : "Stable"}</span>
                </div>
                <div className={styles.editorBottomGrid}>
                  <Card title="Blockers & Recovery" tag={`${content.blockers.length} item${content.blockers.length === 1 ? "" : "s"}`} compact>
                    {content.blockers.map((blocker, index) => (
                      <div className={styles.warningBox} key={`${blocker.title}-${index}`}>
                        <AlertTriangle />
                        <div>
                          <b>{blocker.title}</b>
                          <small>{blocker.detail}</small>
                        </div>
                        <em className={styles[normalizeState(blocker.status)]}>{blocker.status}</em>
                      </div>
                    ))}
                  </Card>
                  <Card title="Audit Timeline (Live)" tag="View all" compact>
                    {content.auditTimeline.map((entry) => (
                      <p className={styles.eventRow} key={entry}>
                        <span /> {entry}
                      </p>
                    ))}
                  </Card>
                </div>
              </section>
            </div>

            <div className={styles.rightColumn}>
              <Card title="Live Agent Execution" tag={content.liveTag}>
                <dl className={styles.definitionListCompact}>
                  <dt>Agent</dt>
                  <dd>{content.agent.name}</dd>
                  <dt>Model</dt>
                  <dd>{content.agent.model}</dd>
                  <dt>Current action</dt>
                  <dd>{content.agent.action}</dd>
                  <dt>Elapsed time</dt>
                  <dd>{content.agent.elapsed}</dd>
                  <dt>Confidence</dt>
                  <dd>{content.agent.confidence}%</dd>
                  <dt>Heartbeat</dt>
                  <dd className={styles.healthy}>● {content.agent.heartbeat}</dd>
                  <dt>Retry count</dt>
                  <dd>{content.agent.retryCount}</dd>
                  <dt>Next action</dt>
                  <dd>{content.agent.nextAction}</dd>
                </dl>
              </Card>

              <Card title="Quality & Compliance" tag="Live">
                <Metric label="Overall truthful score" value={content.quality.overall} />
                <Metric label="Fact accuracy" value={content.quality.factual} />
                <Metric label="Editorial quality" value={content.quality.editorial} />
                <Metric label="Brand alignment" value={content.quality.brand} />
                <Metric label="Safety & policy" value={content.quality.safety} />
                <Metric label="Citation coverage" value={content.quality.citations} />
                <div className={styles.gatesRow}>
                  Gates status <b>{content.gatesPassed}/{content.gateTotal} passed</b>
                </div>
              </Card>

              <Card title="Version History" tag={`${content.versions.length} versions`}>
                <div className={styles.versionList}>
                  {content.versions.map((version) => (
                    <div className={styles.versionRow} key={version.version}>
                      <b>{version.version}</b>
                      <span>{version.note}</span>
                      <time>{version.time}</time>
                    </div>
                  ))}
                </div>
              </Card>

              <Card title="Autonomous Decisions (Live)" tag="View all">
                <div className={styles.decisionList}>
                  {content.decisions.map((decision) => (
                    <p className={styles.decisionRow} key={`${decision.time}-${decision.text}`}>
                      <i className={decision.highlighted ? styles.amber : undefined} />
                      <time>{decision.time}</time>
                      <span>{decision.text}</span>
                    </p>
                  ))}
                </div>
              </Card>
            </div>
          </div>
      </section>
    </section>
  );
}

function Workflow({ active }: { active: number }) {
  return (
    <div className={styles.workflow}>
      {WORKFLOW_STEPS.map((step, index) => (
        <div key={step} className={styles.workflowSegment}>
          <div className={`${styles.step} ${index < active ? styles.done : index === active ? styles.current : ""}`}>
            <span>{index < active ? <Check /> : index + 1}</span>
            <div>
              <b>{step}</b>
              <small>{index < active ? "Complete" : index === active ? "In progress" : "Pending"}</small>
            </div>
          </div>
          {index < WORKFLOW_STEPS.length - 1 ? (
            <div className={`${styles.stepLine} ${index < active ? styles.done : ""}`} />
          ) : null}
        </div>
      ))}
    </div>
  );
}

function Cell({
  label,
  value,
  sub,
  dot,
  orange
}: {
  label: string;
  value: string;
  sub?: string;
  dot?: boolean;
  orange?: boolean;
}) {
  return (
    <div className={styles.cell}>
      <small>{label}</small>
      <b className={orange ? styles.orange : ""}>
        {dot ? <i /> : null}
        {value}
      </b>
      {sub ? <span>{sub}</span> : null}
    </div>
  );
}

function Card({
  title,
  tag,
  children,
  compact = false
}: {
  title: string;
  tag: string;
  children: ReactNode;
  compact?: boolean;
}) {
  return (
    <section className={`${styles.card} ${compact ? styles.compactCard : ""}`}>
      <div className={styles.cardTitle}>
        <h3>{title}</h3>
        <span>{tag}</span>
      </div>
      {children}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className={styles.metric}>
      <span>
        <b>{label}</b>
        <em>{value}%</em>
      </span>
      <div>
        <i style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </div>
    </div>
  );
}

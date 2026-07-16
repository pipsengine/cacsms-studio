"use client";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Database,
  FileText,
  GitBranch,
  History,
  RefreshCw,
  ShieldCheck,
  User,
  Workflow,
  Zap,
  X,
  ChevronRight
} from "lucide-react";
import type {
  ScriptEditorPayload,
  ScriptEditorProduction
} from "@/lib/script-editor-engine";
import styles from "./ScriptEditorWorkspace.module.css";

const stageNames = [
  "research",
  "scripting",
  "storyboard",
  "visual-generation",
  "audio-generation",
  "assembly",
  "quality-assurance",
  "publishing",
  "completed"
];
const writingStates = [
  "waiting",
  "researching",
  "queued",
  "generating",
  "reviewing",
  "revising",
  "blocked",
  "retrying",
  "failed",
  "completed"
];

const pretty = (value: string) =>
  value.replaceAll("-", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

const formatTime = (value: string | null | undefined) =>
  value
    ? new Intl.DateTimeFormat("en-NG", {
        hour: "2-digit",
        minute: "2-digit",
        day: "2-digit",
        month: "short"
      }).format(new Date(value))
    : "Not recorded";

const tone = (value: string) =>
  /failed|blocked|degraded|offline/i.test(value)
    ? "danger"
    : /running|active|researching|generating|revising|retrying/i.test(value)
    ? "active"
    : "good";

const gateTone = (status: string) =>
  status === "passed" ? "good" : status === "warning" ? "warning" : "danger";

export function ScriptEditorWorkspace({ initial, error: initialError }: { initial?: ScriptEditorProduction[]; error?: string } = {}) {
  const [data, setData] = useState<ScriptEditorPayload | null>(initial ? { productions: initial, generatedAt: new Date().toISOString(), engine: "autonomous-script-writing-orchestrator-v2", humanInputRequired: false } : null);
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [loading, setLoading] = useState(!initial && !initialError);
  const [selectedProductionId, setSelectedProductionId] = useState<
    string | null
  >(null);
  const [syncing, setSyncing] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const handle = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(handle);
  }, []);

  useEffect(() => {
    let active = true;
    async function fetchData() {
      try {
        const response = await fetch("/api/writing/script-editor");
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const payload = (await response.json()) as ScriptEditorPayload;
        if (active) {
          setData(payload);
          setError(null);
          setLoading(false);
        }
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error ? err.message : "Failed to load script editor data."
          );
          setLoading(false);
        }
      }
    }
    fetchData();
    const interval = window.setInterval(fetchData, 10000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  const selectedProduction = useMemo(
    () =>
      data?.productions.find(
        (prod) => prod.id === selectedProductionId
      ) ?? null,
    [data, selectedProductionId]
  );

  const productions = data?.productions ?? [];
  const activeProductions = productions.filter(
    (prod) =>
      !["completed", "published", "archived", "failed"].includes(
        prod.status.toLowerCase()
      )
  );
  const completedProductions = productions.filter(
    (prod) => prod.gates.mandatory && prod.execution.state === "completed"
  );

  const handleSync = async (productionId: string, action: "sync" | "retry") => {
    setSyncing(true);
    try {
      const response = await fetch("/api/writing/script-editor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productionId, action })
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const result = await response.json();
      setData((prev) =>
        prev
          ? {
              ...prev,
              productions: prev.productions.map((prod) =>
                prod.id === productionId ? result.production : prod
              )
            }
          : null
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to run script automation."
      );
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <main className={styles.page}>
        <div className={styles.empty}>
          <Database size={24} />
          <strong>Loading script editor telemetry</strong>
          <p>Connecting to the autonomous writing engine data store.</p>
        </div>
      </main>
    );
  }

  const state = selectedProduction
    ? selectedProduction.execution.state
    : data
    ? "waiting"
    : error
    ? "failed"
    : "waiting";
  const stateLabel = error
    ? "Offline"
    : selectedProduction
    ? pretty(selectedProduction.execution.state)
    : "Select a production";

  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <div>
          <span className={styles.eyebrow}>
            WRITING STUDIO / AUTONOMOUS SCRIPT ORCHESTRATOR
          </span>
          <h1>Autonomous Script Editor</h1>
          <p>
            Truth-first writing: every status, decision, gate, and version is
            persisted in SQL. No inferred progress, no fake completions.
          </p>
        </div>
        <div className={styles.heroState}>
          <span className={`${styles.pill} ${styles[tone(stateLabel)]}`}>
            <span className={styles.dot} />
            {stateLabel}
          </span>
          <span className={styles.algorithm}>
            autonomous-script-writing-orchestrator-v2
          </span>
        </div>
      </header>

      {error ? (
        <div
          className={`${styles.banner} ${styles.bannerDanger}`}
          role="alert"
        >
          <AlertTriangle size={18} />
          <span>
            <strong>Writing engine telemetry unavailable.</strong> {error} The
            engine remains governed by its last persisted state.
          </span>
          <span className={styles.bannerAction}>
            <RefreshCw size={15} />
            Auto-retry in 10s
          </span>
        </div>
      ) : (
        <div className={styles.banner}>
          <CheckCircle2 size={18} />
          <span>
            <strong>Live database telemetry.</strong> Writing engine status,
            agent activity, gate results, and audit history are read from
            persisted SQL tables only.
          </span>
          <span className={styles.bannerAction}>
            No operator action required
          </span>
        </div>
      )}

      <section className={styles.kpis} aria-label="Script editor KPIs">
        <Kpi
          icon={<Database />}
          label="Active productions"
          value={String(activeProductions.length)}
          detail="Eligible for writing"
          tone="blue"
        />
        <Kpi
          icon={<Zap />}
          label="Mandatory gates passed"
          value={String(completedProductions.length)}
          detail="Ready for next stage"
          tone="green"
        />
        <Kpi
          icon={<ShieldCheck />}
          label="Total versions"
          value={String(
            productions.reduce(
              (sum, prod) => sum + (prod.versions?.length ?? 0),
              0
            )
          )}
          detail="Immutable script versions"
          tone="violet"
        />
        <Kpi
          icon={<Clock3 />}
          label="Data refreshed"
          value={now ? "Now" : "—"}
          detail={data?.generatedAt ? formatTime(data.generatedAt) : "Pending"}
          tone="amber"
        />
      </section>

      {selectedProduction && (
        <section className={styles.mainGrid} style={{ gridTemplateColumns: "1fr" }}>
          <article className={styles.panel}>
            <div className={styles.panelHead}>
              <div>
                <h2>
                  {selectedProduction.title}
                  <small> · {selectedProduction.code}</small>
                </h2>
                <p>{selectedProduction.type}</p>
              </div>
              <button
                className={styles.button}
                onClick={() => setSelectedProductionId(null)}
              >
                <X size={14} />
                Close
              </button>
            </div>

            <section className={styles.selectedProduction}>
              <div className={styles.sectionHeader}>
                <h3>Execution Telemetry</h3>
              </div>
              <div className={styles.telemetry}>
                <div>
                  <span>Current state</span>
                  <strong>{pretty(selectedProduction.execution.state)}</strong>
                  <small>{selectedProduction.execution.currentAction}</small>
                </div>
                <div>
                  <span>Agent</span>
                  <strong>
                    {selectedProduction.execution.currentAgent ?? "—"}
                  </strong>
                  <small>
                    {selectedProduction.execution.currentRole ?? "Idle"}
                  </small>
                </div>
                <div>
                  <span>Model</span>
                  <strong>
                    {selectedProduction.execution.model ?? "—"}
                  </strong>
                  <small>
                    Job: {selectedProduction.execution.jobId ?? "—"}
                  </small>
                </div>
                <div>
                  <span>Started</span>
                  <strong>
                    {formatTime(selectedProduction.execution.startedAt)}
                  </strong>
                  <small>
                    {selectedProduction.execution.elapsedSeconds !== null
                      ? `${selectedProduction.execution.elapsedSeconds}s elapsed`
                      : "—"}
                  </small>
                </div>
              </div>

              <div className={styles.sectionHeader}>
                <h3>Mandatory Gates</h3>
                <span
                  className={styles.count}
                  style={{
                    color: selectedProduction.gates.mandatory
                      ? "#047857"
                      : "#b91c1c"
                  }}
                >
                  {selectedProduction.gates.mandatory
                    ? "All passed"
                    : "Incomplete"}
                </span>
              </div>
              <div className={styles.gateGrid}>
                <Gate
                  label="Brief"
                  passed={selectedProduction.gates.brief}
                  score={
                    selectedProduction.gates.brief ? 100 : undefined
                  }
                />
                <Gate
                  label="Research"
                  passed={selectedProduction.gates.research}
                  score={
                    selectedProduction.gates.research ? 100 : undefined
                  }
                />
                <Gate
                  label="Sections"
                  passed={selectedProduction.gates.sections}
                  score={
                    selectedProduction.gates.sections ? 100 : undefined
                  }
                />
                <Gate
                  label="Versions"
                  passed={selectedProduction.gates.versions}
                  score={
                    selectedProduction.gates.versions ? 100 : undefined
                  }
                />
                <Gate
                  label="Quality"
                  passed={selectedProduction.gates.quality}
                  score={
                    selectedProduction.gates.quality
                      ? selectedProduction.qualityScore
                      : undefined
                  }
                />
                <Gate
                  label="Mandatory"
                  passed={selectedProduction.gates.mandatory}
                  score={
                    selectedProduction.gates.mandatory ? 100 : undefined
                  }
                />
              </div>

              <div className={styles.sectionHeader}>
                <h3>Quality Checks</h3>
              </div>
              <div className={styles.gateGrid}>
                {selectedProduction.checks?.map((check) => (
                  <div
                    key={`${check.attemptNumber}-${check.type}`}
                    className={`${styles.gate} ${
                      styles[gateTone(check.status)]
                    }`}
                  >
                    <div className={styles.gateTop}>
                      <strong>{check.type}</strong>
                      <span>{Math.round(check.score)}%</span>
                    </div>
                    <p>{check.notes}</p>
                  </div>
                ))}
              </div>

              <div className={styles.sectionHeader}>
                <h3>Actions</h3>
              </div>
              <div className={styles.buttonRow}>
                <button
                  className={styles.button}
                  disabled={syncing}
                  onClick={() =>
                    handleSync(selectedProduction.id, "sync")
                  }
                >
                  <RefreshCw size={14} />
                  Sync Now
                </button>
                <button
                  className={`${styles.button} ${styles.primary}`}
                  disabled={
                    syncing ||
                    (selectedProduction.execution.state !== "blocked" &&
                      selectedProduction.execution.state !== "failed")
                  }
                  onClick={() =>
                    handleSync(selectedProduction.id, "retry")
                  }
                >
                  <Zap size={14} />
                  Retry
                </button>
              </div>
            </section>
          </article>
        </section>
      )}

      {!selectedProduction && (
        <section className={styles.mainGrid}>
          <article className={styles.panel}>
            <div className={styles.panelHead}>
              <div>
                <h2>Production queue</h2>
                <p>
                  Productions eligible for autonomous script writing, ordered by
                  stage priority.
                </p>
              </div>
              <span className={styles.count}>
                {productions.length} productions
              </span>
            </div>
            {productions.length === 0 ? (
              <Empty
                title="No eligible productions"
                detail="No productions are currently in the research or scripting stage. Create or promote a production to enable the autonomous writing engine."
              />
            ) : (
              <div className={styles.tableWrap}>
                <table>
                  <caption className={styles.srOnly}>
                    Script production queue
                  </caption>
                  <thead>
                    <tr>
                      <th>Production</th>
                      <th>Pipeline stage</th>
                      <th>Writing state</th>
                      <th>Word count</th>
                      <th>Progress</th>
                      <th>Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productions.map((prod) => (
                      <tr
                        key={prod.id}
                        onClick={() => setSelectedProductionId(prod.id)}
                        style={{ cursor: "pointer" }}
                      >
                        <td>
                          <strong>{prod.title}</strong>
                          <small>
                            {prod.code} · {prod.type}
                          </small>
                        </td>
                        <td>
                          <span className={styles.stageTag}>
                            <Workflow size={13} />
                            {pretty(prod.stage)}
                          </span>
                        </td>
                        <td>
                          <span
                            className={`${styles.priority} ${
                              styles[tone(prod.execution.state)]
                            }`}
                          >
                            {pretty(prod.execution.state)}
                          </span>
                        </td>
                        <td>
                          <strong>{prod.wordCount}</strong>
                          <small>words</small>
                        </td>
                        <td>
                          <div className={styles.progress}>
                            <span
                              style={{
                                width: `${Math.min(
                                  100,
                                  Math.max(0, prod.progress)
                                )}%`
                              }}
                            />
                          </div>
                          <small>{Math.round(prod.progress)}%</small>
                        </td>
                        <td>{formatTime(prod.updatedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </article>

          <aside className={styles.sideStack}>
            <article className={styles.panel}>
              <div className={styles.panelHead}>
                <div>
                  <h2>Stage distribution</h2>
                  <p>Current work across the pipeline stages.</p>
                </div>
                <GitBranch size={18} />
              </div>
              <div className={styles.timeline}>
                {stageNames.map((stage) => {
                  const count = activeProductions.filter(
                    (item) => item.stage === stage
                  ).length;
                  return (
                    <div className={styles.timelineRow} key={stage}>
                      <span>{pretty(stage)}</span>
                      <div>
                        <i
                          style={{
                            width: `${
                              activeProductions.length
                                ? Math.max(
                                    4,
                                    (count / activeProductions.length) * 100
                                  )
                                : 0
                            }%`
                          }}
                        />
                      </div>
                      <strong>{count}</strong>
                    </div>
                  );
                })}
              </div>
            </article>

            <article className={styles.panel}>
              <div className={styles.panelHead}>
                <div>
                  <h2>Recent decisions</h2>
                  <p>Persisted engine actions and rationale.</p>
                </div>
                <History size={18} />
              </div>
              <div className={styles.log}>
                {(() => {
                  const allDecisions = productions
                    .flatMap((prod) =>
                      (prod.decisions ?? []).map((d) => ({ ...d, prod }))
                    )
                    .sort(
                      (a, b) =>
                        new Date(b.createdAt).getTime() -
                        new Date(a.createdAt).getTime()
                    )
                    .slice(0, 5);
                  return allDecisions.length > 0 ? (
                    allDecisions.map((item) => (
                      <div
                        className={styles.logRow}
                        key={`${item.prod.id}-${item.id}`}
                      >
                        <span
                          className={`${styles.logIcon} ${
                            styles[tone(item.action)]
                          }`}
                        >
                          <ArrowRight size={14} />
                        </span>
                        <div>
                          <strong>{item.prod.title}</strong>
                          <small>
                            {pretty(item.action)} · {item.step}
                          </small>
                        </div>
                        <time>{formatTime(item.createdAt)}</time>
                      </div>
                    ))
                  ) : (
                    <Empty
                      title="No decisions recorded"
                      detail="Decision history will appear after the first autonomous writing cycle runs."
                    />
                  );
                })()}
              </div>
            </article>
          </aside>
        </section>
      )}

      {!selectedProduction && (
        <section className={styles.bottomGrid}>
          <article className={styles.panel}>
            <div className={styles.panelHead}>
              <div>
                <h2>Latest audit history</h2>
                <p>Persisted events from the writing engine.</p>
              </div>
              <span className={styles.count}>
                {productions.reduce(
                  (sum, prod) => sum + (prod.audit?.length ?? 0),
                  0
                )}{" "}
                events
              </span>
            </div>
            <div className={styles.readyList}>
              {(() => {
                const allAudit = productions
                  .flatMap((prod) =>
                    (prod.audit ?? []).map((a) => ({ ...a, prod }))
                  )
                  .sort(
                    (a, b) =>
                      new Date(b.createdAt).getTime() -
                      new Date(a.createdAt).getTime()
                  )
                  .slice(0, 8);
                return allAudit.length > 0 ? (
                  allAudit.map((item, index) => (
                    <div
                      className={styles.readyRow}
                      key={`${item.prod.id}-${item.id}-${index}`}
                    >
                      <span className={styles.readyIcon}>
                        <FileText size={16} />
                      </span>
                      <div>
                        <strong>{item.label}</strong>
                        <small>
                          {item.detail} · {item.prod.title}
                        </small>
                      </div>
                      <span className={styles.defer}>
                        {formatTime(item.createdAt)}
                      </span>
                    </div>
                  ))
                ) : (
                  <Empty
                    title="No audit history"
                    detail="Audit events will appear after the first autonomous writing cycle runs."
                  />
                );
              })()}
            </div>
          </article>

          <article className={styles.panel}>
            <div className={styles.panelHead}>
              <div>
                <h2>Governance</h2>
                <p>Truth-first execution rules.</p>
              </div>
              <ShieldCheck size={18} />
            </div>
            <div className={styles.historyGrid}>
              <div>
                <span>No fake completions</span>
                <strong>SQL-only</strong>
              </div>
              <div>
                <span>Mandatory gates</span>
                <strong>Enforced</strong>
              </div>
              <div>
                <span>Immutable versions</span>
                <strong>Yes</strong>
              </div>
              <div>
                <span>Full audit trail</span>
                <strong>Persisted</strong>
              </div>
            </div>
            <div className={styles.governance}>
              <ShieldCheck size={17} />
              <span>
                <strong>Human input required: 0</strong>
                <small>
                  The writing engine validates briefs, retrieves research,
                  generates sections, runs gates, revises, and advances only
                  when all persisted checks pass.
                </small>
              </span>
            </div>
          </article>
        </section>
      )}
    </main>
  );
}

function Kpi({
  icon,
  label,
  value,
  detail,
  tone
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
  tone: string;
}) {
  return (
    <article className={styles.kpi}>
      <span className={`${styles.kpiIcon} ${styles[tone]}`}>{icon}</span>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{detail}</small>
      </div>
    </article>
  );
}

function Empty({ title, detail }: { title: string; detail: string }) {
  return (
    <div className={styles.empty}>
      <Database size={22} />
      <strong>{title}</strong>
      <p>{detail}</p>
    </div>
  );
}

function Gate({
  label,
  passed,
  score
}: {
  label: string;
  passed: boolean;
  score?: number;
}) {
  const status = passed ? "passed" : "warning";
  return (
    <div className={`${styles.gate} ${styles[gateTone(status)]}`}>
      <div className={styles.gateTop}>
        <strong>{label}</strong>
        {score !== undefined ? <span>{Math.round(score)}%</span> : null}
        {passed && <CheckCircle2 size={16} color="#047857" />}
      </div>
      <p>{passed ? "Gate passed" : "Gate not yet satisfied"}</p>
    </div>
  );
}

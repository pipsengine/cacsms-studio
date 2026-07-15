"use client";

import {
  Activity,
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  CircleDot,
  Clock3,
  DatabaseZap,
  GitBranch,
  Globe2,
  Network,
  Radar,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Zap
} from "lucide-react";
import {useCallback, useEffect, useMemo, useState, type ComponentType} from "react";
import styles from "./PredictionEnginePage.module.css";

type Metric = {label: string; value: string; detail: string; tone: "blue" | "green" | "purple" | "orange"};
type Forecast = {id: string; title: string; subtitle: string; category: string; score: number; status: string; horizon: string; probability: number; impact: string; action: string; updatedAt: string};
type PredictionData = {
  forecasts: Forecast[];
  metrics: Metric[];
  models: Array<{title: string; score: number; detail: string}>;
  stages: Array<[string, number, string]>;
  events: Array<{time: string; title: string; detail: string}>;
  updatedAt: string | null;
};

const metricIcons: ComponentType<{size?: number}>[] = [Radar, Target, ShieldCheck, Zap];
const fallback: PredictionData = {
  forecasts: [],
  metrics: [
    {label: "Forecasts running", value: "--", detail: "DB-backed autonomous models", tone: "blue"},
    {label: "Opportunity predictions", value: "--", detail: "Qualified for discovery", tone: "green"},
    {label: "Confidence average", value: "--", detail: "Cross-source agreement", tone: "purple"},
    {label: "Auto-promotions", value: "--", detail: "Moved to opportunity queue", tone: "orange"},
  ],
  models: [
    {title: "Trend Momentum Model", score: 91, detail: "Predicts acceleration, saturation, and decay windows."},
    {title: "Audience Demand Model", score: 88, detail: "Forecasts demand by market, channel, and content format."},
    {title: "Knowledge Gap Model", score: 84, detail: "Finds underserved areas with production-ready evidence."},
    {title: "Timing Risk Model", score: 79, detail: "Detects fragile windows, oversaturation, and weak evidence."}
  ],
  stages: [["Signal ingestion", 100, "18 live sources"], ["Pattern detection", 92, "Autonomous forecasts"], ["Confidence scoring", 88, "Knowledge graph weighted"], ["Autonomous decision", 74, "Auto policy active"], ["Lifecycle handoff", 82, "Discovery queue updated"]],
  events: [],
  updatedAt: null,
};

function statusText(status: string) {
  return status.replaceAll("-", " ");
}

export function PredictionEnginePage() {
  const [data, setData] = useState<PredictionData>(fallback);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch("/api/knowledge-universe/prediction-engine", {cache: "no-store", signal});
      const payload = (await response.json()) as PredictionData | {message?: string};
      if (!response.ok) throw new Error("message" in payload && payload.message ? payload.message : "Unable to load prediction engine data.");
      setData(payload as PredictionData);
      setMessage("");
    } catch (error) {
      if ((error as Error).name !== "AbortError") setMessage((error as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    const timer = window.setInterval(() => void load(), 30000);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [load]);

  const topForecast = data.forecasts[0];
  const lastUpdate = useMemo(() => data.updatedAt ? new Intl.DateTimeFormat("en-GB", {hour: "2-digit", minute: "2-digit", second: "2-digit"}).format(new Date(data.updatedAt)) : "continuous", [data.updatedAt]);

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <div>
          <span>Knowledge Universe / Discover</span>
          <h1>Prediction Engine</h1>
          <p>Autonomous forward-looking intelligence that predicts production opportunities before they become obvious.</p>
        </div>
        <aside>
          <Sparkles size={18} />
          <b>Autonomous mode active</b>
          <small>No human input required for discovery handoff.</small>
        </aside>
      </header>

      {message ? <p className={styles.notice}>{message}</p> : null}

      <section className={styles.command}>
        <div className={styles.commandIcon}><BrainCircuit size={30} /></div>
        <div>
          <strong>Prediction loop online</strong>
          <span>Signal ingestion, pattern detection, scoring, decisioning, and lifecycle handoff are running continuously. Last DB sync: {lastUpdate}.</span>
        </div>
        <dl>
          <div><dt>Policy</dt><dd>Auto-promote at 90%</dd></div>
          <div><dt>Horizon</dt><dd>7-90 days</dd></div>
          <div><dt>Next run</dt><dd>{loading ? "Syncing" : "Continuous"}</dd></div>
        </dl>
      </section>

      <section className={styles.metrics}>
        {data.metrics.map(({ label, value, detail, tone }, index) => {
          const Icon = metricIcons[index] ?? Radar;
          return (
            <article key={label} data-tone={tone}>
              <i><Icon size={25} /></i>
              <span><small>{label}</small><strong>{value}</strong><em>{detail}</em></span>
            </article>
          );
        })}
      </section>

      <div className={styles.grid}>
        <main>
          <section className={styles.panel}>
            <header className={styles.panelHead}>
              <div>
                <h2>Autonomous Forecast Queue</h2>
                <p>Predictions ranked by probability, impact, confidence, timing, and readiness for Discover-stage handoff.</p>
              </div>
              <b><CircleDot size={13} /> Live</b>
            </header>
            <div className={styles.table}>
              <header><span>Forecast</span><span>Horizon</span><span>Probability</span><span>Impact</span><span>System action</span><span>Status</span></header>
              {data.forecasts.map((row) => (
                <article key={row.id}>
                  <span><b>{row.title}</b><small>{row.subtitle || "Knowledge graph, trends, gaps, and audience signals aligned"}</small></span>
                  <time>{row.horizon}</time>
                  <span className={styles.score}><b>{row.probability}%</b><i><u style={{ width: `${row.probability}%` }} /></i></span>
                  <strong>{row.impact}</strong>
                  <span>{row.action}</span>
                  <em data-status={row.status}>{statusText(row.status)}</em>
                </article>
              ))}
            </div>
          </section>

          <section className={styles.panel}>
            <header className={styles.panelHead}>
              <div>
                <h2>Prediction Formation</h2>
                <p>How raw knowledge and external signals become autonomous production opportunities.</p>
              </div>
            </header>
            <div className={styles.flow}>
              {data.stages.map(([label, value, detail], index) => (
                <article key={label}>
                  <b>{index + 1}</b>
                  <span>{label}</span>
                  <i><u style={{ width: `${value}%` }} /></i>
                  <small>{detail}</small>
                  {index < data.stages.length - 1 ? <ArrowRight size={16} /> : <CheckCircle2 size={16} />}
                </article>
              ))}
            </div>
          </section>
        </main>

        <aside className={styles.rail}>
          <section className={styles.panel}>
            <h2>Model Ensemble</h2>
            <div className={styles.models}>
              {data.models.map((model) => (
                <article key={model.title}>
                  <Network size={17} />
                  <span><b>{model.title}</b><small>{model.detail}</small></span>
                  <strong>{model.score}%</strong>
                </article>
              ))}
            </div>
          </section>

          <section className={styles.panel}>
            <h2>Autonomous Policy</h2>
            <dl className={styles.policy}>
              <div><dt><ShieldCheck size={15} /> Promotion threshold</dt><dd>90% confidence and 3-source agreement</dd></div>
              <div><dt><DatabaseZap size={15} /> Evidence rule</dt><dd>Attach verified knowledge before handoff</dd></div>
              <div><dt><GitBranch size={15} /> Lifecycle target</dt><dd>Discover stage opportunity queue</dd></div>
              <div><dt><Clock3 size={15} /> Recheck cadence</dt><dd>Continuous with decay-aware refresh</dd></div>
            </dl>
          </section>

          <section className={`${styles.panel} ${styles.map}`}>
            <h2>Market Forecast Map</h2>
            <div>
              <Globe2 size={150} />
              <button style={{ left: "42%", top: "42%" }}>Nigeria <b>{topForecast?.score ?? 94}%</b></button>
              <button style={{ left: "50%", top: "34%" }}>West Africa <b>89%</b></button>
              <button style={{ left: "59%", top: "48%" }}>Global <b>82%</b></button>
            </div>
          </section>
        </aside>
      </div>

      <section className={styles.events}>
        <header>
          <h2>Autonomous Decision Log</h2>
          <span><Activity size={14} /> Last 20 minutes</span>
        </header>
        {data.events.map(({time, title, detail}) => (
          <article key={`${time}-${title}-${detail}`}>
            <time>{time}</time>
            <span><b>{title}</b><small>{detail}</small></span>
            <TrendingUp size={16} />
          </article>
        ))}
      </section>
    </section>
  );
}

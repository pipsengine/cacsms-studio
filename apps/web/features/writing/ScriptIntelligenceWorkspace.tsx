"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Bot, BrainCircuit, Clock3, Eye, MapPinned, Package, ScanSearch, Smile, UserRound, Wifi } from "lucide-react";

type ScriptEntity = {
  label: string;
  mentions: number;
};

type ScriptSceneBoundary = {
  label: string;
  index: number;
};

type ScriptIntelligenceManifest = {
  generatedAt: string;
  method: string;
  scriptUpdatedAt: string | null;
  wordCount: number;
  characters: ScriptEntity[];
  locations: ScriptEntity[];
  timePeriods: ScriptEntity[];
  props: ScriptEntity[];
  emotions: ScriptEntity[];
  visualOpportunities: Array<{ excerpt: string; index: number }>;
  sceneBoundaries: ScriptSceneBoundary[];
};

type ScriptIntelligenceProduction = {
  id: string;
  code: string;
  title: string;
  stage: string;
  status: string;
  priority: string;
  updatedAt: string;
  wordCount: number;
  method: string;
  generatedAt: string;
  stored: boolean;
  manifest: ScriptIntelligenceManifest | null;
};

type ScriptIntelligencePayload = {
  generatedAt: string;
  productions: ScriptIntelligenceProduction[];
  summary: {
    total: number;
    withScripts: number;
    withManifest: number;
    averageWordCount: number;
  };
};

const REFRESH_MS = 10_000;
const SCHEDULER_MS = 15_000;

function formatTime(iso: string | null | undefined) {
  if (!iso) return "Waiting";
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(new Date(iso));
}

function EntityRail({ title, icon, items }: { title: string; icon: React.ReactNode; items: ScriptEntity[] }) {
  return (
    <article className="card">
      <h3 style={{ display: "flex", gap: 8, alignItems: "center" }}>
        {icon}
        {title}
      </h3>
      <div className="pill-row">
        {items.length ? (
          items.map((item) => (
            <span className="pill" key={`${title}-${item.label}`}>
              {item.label} · {item.mentions}
            </span>
          ))
        ) : (
          <span className="pill">No extracted entities yet</span>
        )}
      </div>
    </article>
  );
}

export function ScriptIntelligenceWorkspace({
  initial,
  error: initialError
}: {
  initial?: ScriptIntelligencePayload | null;
  error?: string | null;
}) {
  const [data, setData] = useState<ScriptIntelligencePayload | null>(initial ?? null);
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [loading, setLoading] = useState(!initial && !initialError);
  const [streamLive, setStreamLive] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(initial?.productions[0]?.id ?? null);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/writing/script-intelligence", {
        cache: "no-store",
        headers: { Accept: "application/json" }
      });
      const payload = (await response.json()) as ScriptIntelligencePayload | { message?: string };
      if (!response.ok) throw new Error("message" in payload ? payload.message || `HTTP ${response.status}` : `HTTP ${response.status}`);
      const next = payload as ScriptIntelligencePayload;
      setData(next);
      setSelectedId((current) => current ?? next.productions[0]?.id ?? null);
      setError(null);
      setStreamLive(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Failed to load script intelligence.");
      setStreamLive(false);
    } finally {
      setLoading(false);
    }
  }, []);

  const runScheduler = useCallback(async () => {
    try {
      await fetch("/api/writing/script-intelligence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "scheduler" })
      });
    } catch {}
  }, []);

  useEffect(() => {
    void refresh();
    const refreshTimer = window.setInterval(() => void refresh(), REFRESH_MS);
    const schedulerTimer = window.setInterval(() => void runScheduler(), SCHEDULER_MS);
    return () => {
      window.clearInterval(refreshTimer);
      window.clearInterval(schedulerTimer);
    };
  }, [refresh, runScheduler]);

  const selected = useMemo(
    () => data?.productions.find((item) => item.id === selectedId) ?? data?.productions[0] ?? null,
    [data, selectedId]
  );

  return (
    <>
      <section className="page-header">
        <span className="eyebrow">Writing Studio</span>
        <h2>Script Intelligence</h2>
        <p>
          Converts persisted scripts into structured downstream intelligence for characters, locations, time period,
          props, emotions, visual opportunities, and scene boundaries.
        </p>
      </section>

      <section className="grid cols-4">
        <article className="card">
          <div className="metric">{data?.summary.total ?? 0}</div>
          <h3>Tracked productions</h3>
          <p>Eligible writing records in the active workspace.</p>
        </article>
        <article className="card">
          <div className="metric">{data?.summary.withScripts ?? 0}</div>
          <h3>Scripts detected</h3>
          <p>Productions with persisted script versions.</p>
        </article>
        <article className="card">
          <div className="metric">{data?.summary.withManifest ?? 0}</div>
          <h3>Manifests stored</h3>
          <p>Structured script intelligence persisted to production metadata.</p>
        </article>
        <article className="card">
          <div className="metric">{data?.summary.averageWordCount ?? 0}</div>
          <h3>Average word count</h3>
          <p>Used to estimate downstream visual extraction density.</p>
        </article>
      </section>

      <section className="grid cols-3" style={{ marginTop: 16 }}>
        <article className="card">
          <h3>Production queue</h3>
          <div className="stage-list">
            {data?.productions.length ? (
              data.productions.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  className="stage"
                  onClick={() => setSelectedId(item.id)}
                  style={{
                    textAlign: "left",
                    background: selected?.id === item.id ? "rgba(8,100,95,0.08)" : undefined,
                    border: selected?.id === item.id ? "1px solid rgba(8,100,95,0.2)" : undefined
                  }}
                >
                  <span className="stage-number">{item.code}</span>
                  <span>
                    <h3>{item.title}</h3>
                    <p>
                      {item.stage} · {item.status} · {item.wordCount} words
                    </p>
                  </span>
                  <span className="status">{item.stored ? "Persisted" : "Waiting"}</span>
                </button>
              ))
            ) : (
              <div className="stage">
                <span className="stage-number">0</span>
                <span>
                  <h3>No productions available</h3>
                  <p>Script intelligence will activate automatically when writing data exists.</p>
                </span>
                <span className="status">Idle</span>
              </div>
            )}
          </div>
        </article>

        <article className="card">
          <h3>Extraction telemetry</h3>
          <div className="stage-list">
            {[
              ["Engine", selected?.method ?? "heuristic-script-intelligence-v1"],
              ["Manifest time", formatTime(selected?.generatedAt)],
              ["Script time", formatTime(selected?.manifest?.scriptUpdatedAt)],
              ["Realtime link", streamLive ? "Polling live" : "Retrying"],
              ["Manifest status", selected?.stored ? "Persisted" : "Pending"],
              ["Word count", String(selected?.wordCount ?? 0)]
            ].map(([label, value], index) => (
              <div className="stage compact-stage" key={label}>
                <span className="stage-number">{index + 1}</span>
                <span>
                  <h3>{label}</h3>
                  <p>{value}</p>
                </span>
                <span className="status">Active</span>
              </div>
            ))}
          </div>
        </article>

        <article className="card">
          <h3>Agent rail</h3>
          <div className="stage-list">
            {[
              ["Script manifest resolver", "Converts persisted script versions into structured entities and scene boundaries."],
              ["Visual cue miner", "Flags downstream image opportunities and production-safe visual prompts."],
              ["Scene segmentation agent", "Detects scene boundaries to prepare storyboard and asset planning."],
              ["Metadata synchronizer", "Writes ScriptManifest into production metadata for cross-module handoff."]
            ].map(([label, detail]) => (
              <div className="stage compact-stage" key={label}>
                <Bot size={18} aria-hidden="true" />
                <span>
                  <h3>{label}</h3>
                  <p>{detail}</p>
                </span>
                <span className="status">Auto</span>
              </div>
            ))}
          </div>
        </article>
      </section>

      {error ? (
        <section className="card" style={{ marginTop: 16 }}>
          <h3>Workspace issue</h3>
          <p>{error}</p>
        </section>
      ) : null}

      {loading ? (
        <section className="card" style={{ marginTop: 16 }}>
          <h3>Loading intelligence</h3>
          <p>The writing engine is collecting persisted script evidence.</p>
        </section>
      ) : null}

      {selected ? (
        <>
          <section className="grid cols-3" style={{ marginTop: 16 }}>
            <EntityRail title="Characters" icon={<UserRound size={18} aria-hidden="true" />} items={selected.manifest?.characters ?? []} />
            <EntityRail title="Locations" icon={<MapPinned size={18} aria-hidden="true" />} items={selected.manifest?.locations ?? []} />
            <EntityRail title="Time Periods" icon={<Clock3 size={18} aria-hidden="true" />} items={selected.manifest?.timePeriods ?? []} />
          </section>

          <section className="grid cols-3" style={{ marginTop: 16 }}>
            <EntityRail title="Props & Objects" icon={<Package size={18} aria-hidden="true" />} items={selected.manifest?.props ?? []} />
            <EntityRail title="Emotional Tone" icon={<Smile size={18} aria-hidden="true" />} items={selected.manifest?.emotions ?? []} />
            <article className="card">
              <h3 style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <BrainCircuit size={18} aria-hidden="true" />
                Scene boundaries
              </h3>
              <div className="stage-list">
                {selected.manifest?.sceneBoundaries.length ? (
                  selected.manifest.sceneBoundaries.map((item) => (
                    <div className="stage compact-stage" key={`${item.index}-${item.label}`}>
                      <span className="stage-number">{item.index + 1}</span>
                      <span>
                        <h3>{item.label}</h3>
                        <p>Detected scene boundary for storyboard decomposition.</p>
                      </span>
                      <span className="status">Scene</span>
                    </div>
                  ))
                ) : (
                  <div className="stage compact-stage">
                    <Wifi size={18} aria-hidden="true" />
                    <span>
                      <h3>No explicit scene headings yet</h3>
                      <p>Scene segmentation will continue as more structured script versions are stored.</p>
                    </span>
                    <span className="status">Waiting</span>
                  </div>
                )}
              </div>
            </article>
          </section>

          <section className="card" style={{ marginTop: 16 }}>
            <h3 style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <Eye size={18} aria-hidden="true" />
              Visual opportunities
            </h3>
            <div className="stage-list">
              {selected.manifest?.visualOpportunities.length ? (
                selected.manifest.visualOpportunities.map((item) => (
                  <div className="stage" key={`${item.index}-${item.excerpt}`}>
                    <span className="stage-number">{item.index + 1}</span>
                    <span>
                      <h3>Detected visual cue</h3>
                      <p>{item.excerpt}</p>
                    </span>
                    <span className="status">Ready</span>
                  </div>
                ))
              ) : (
                <div className="stage">
                  <span className="stage-number">0</span>
                  <span>
                    <h3>No visual cues extracted yet</h3>
                    <p>Visual opportunity extraction activates when descriptive cinematic or instructional lines exist.</p>
                  </span>
                  <span className="status">Waiting</span>
                </div>
              )}
            </div>
          </section>

          <section className="card" style={{ marginTop: 16 }}>
            <h3 style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <ScanSearch size={18} aria-hidden="true" />
              Structured downstream handoff
            </h3>
            <p style={{ marginBottom: 0 }}>
              This workspace writes a persisted ScriptManifest into production metadata so storyboard, visual, and video
              workspaces can claim characters, locations, time-period hints, props, emotions, visual opportunities, and
              scene boundaries without requiring manual prompt entry.
            </p>
          </section>
        </>
      ) : null}
    </>
  );
}


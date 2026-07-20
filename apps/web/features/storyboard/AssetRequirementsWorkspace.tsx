"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Boxes, CheckCircle2, Clock3, Film, Layers, ListChecks, ShieldCheck, Wifi } from "lucide-react";

type AssetRequirementCategory = {
  category: string;
  required: number;
  satisfied: number;
};

type AssetRequirementScene = {
  sceneId: string;
  number: number;
  title: string;
  shotCount: number;
  required: number;
  satisfied: number;
  categories: AssetRequirementCategory[];
};

type AssetRequirementManifest = {
  generatedAt: string;
  method: string;
  productionId: string;
  productionCode: string;
  versionLabel: string;
  scenes: AssetRequirementScene[];
  totals: {
    required: number;
    satisfied: number;
  };
};

type AssetRequirementsProduction = {
  id: string;
  code: string;
  title: string;
  stage: string;
  status: string;
  updatedAt: string;
  routingLocked: boolean;
  manifest: AssetRequirementManifest | null;
};

type AssetRequirementsPayload = {
  generatedAt: string;
  productions: AssetRequirementsProduction[];
  summary: {
    total: number;
    withManifest: number;
    requiredAssets: number;
    satisfiedAssets: number;
  };
};

const REFRESH_MS = 10_000;
const SYNC_MS = 15_000;

function formatTime(iso: string | null | undefined) {
  if (!iso) return "--:--:--";
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(new Date(iso));
}

export function AssetRequirementsWorkspace({
  initial,
  error: initialError,
  mode
}: {
  initial?: AssetRequirementsPayload | null;
  error?: string | null;
  mode: "resolver" | "matrix";
}) {
  const [data, setData] = useState<AssetRequirementsPayload | null>(initial ?? null);
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [loading, setLoading] = useState(!initial && !initialError);
  const [streamLive, setStreamLive] = useState(false);
  const [selectedProductionId, setSelectedProductionId] = useState<string | null>(initial?.productions[0]?.id ?? null);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/storyboard/asset-requirements", { cache: "no-store" });
      const payload = (await response.json()) as AssetRequirementsPayload | { message?: string };
      if (!response.ok) throw new Error("message" in payload ? payload.message || `HTTP ${response.status}` : `HTTP ${response.status}`);
      const next = payload as AssetRequirementsPayload;
      setData(next);
      setSelectedProductionId((current) => current ?? next.productions[0]?.id ?? null);
      setStreamLive(true);
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Failed to load storyboard asset requirements.");
      setStreamLive(false);
    } finally {
      setLoading(false);
    }
  }, []);

  const sync = useCallback(async () => {
    try {
      await fetch("/api/storyboard/asset-requirements", { method: "POST" });
    } catch {}
  }, []);

  useEffect(() => {
    void refresh();
    const refreshTimer = window.setInterval(() => void refresh(), REFRESH_MS);
    const syncTimer = window.setInterval(() => void sync(), SYNC_MS);
    return () => {
      window.clearInterval(refreshTimer);
      window.clearInterval(syncTimer);
    };
  }, [refresh, sync]);

  const selectedProduction = useMemo(
    () => data?.productions.find((item) => item.id === selectedProductionId) ?? data?.productions[0] ?? null,
    [data, selectedProductionId]
  );

  const manifest = selectedProduction?.manifest ?? null;
  const title = mode === "resolver" ? "Visual Requirement Resolver" : "Asset Requirement Matrix";

  return (
    <>
      <section className="page-header">
        <span className="eyebrow">Storyboard Studio</span>
        <h2>{title}</h2>
        <p>
          Converts storyboard scenes and shots into a structured asset requirement manifest. This is the authoritative
          handoff for Visual Studio to claim generation work without manual prompts.
        </p>
      </section>

      <section className="grid cols-4">
        <article className="card">
          <div className="metric">{data?.summary.total ?? 0}</div>
          <h3>Storyboard productions</h3>
          <p>Active storyboard records detected.</p>
        </article>
        <article className="card">
          <div className="metric">{data?.summary.requiredAssets ?? 0}</div>
          <h3>Required assets</h3>
          <p>Total shot-level requirements.</p>
        </article>
        <article className="card">
          <div className="metric">{data?.summary.satisfiedAssets ?? 0}</div>
          <h3>Satisfied assets</h3>
          <p>Preview assets linked at shot level.</p>
        </article>
        <article className="card">
          <div className="metric">{streamLive ? "Live" : "Retrying"}</div>
          <h3>Realtime adapter</h3>
          <p>Polling state for requirements sync.</p>
        </article>
      </section>

      <section className="grid cols-3" style={{ marginTop: 16 }}>
        <article className="card">
          <h3>Production selector</h3>
          <div className="stage-list">
            {data?.productions.length ? (
              data.productions.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  className="stage"
                  onClick={() => setSelectedProductionId(item.id)}
                  style={{
                    textAlign: "left",
                    background: selectedProduction?.id === item.id ? "rgba(8,100,95,0.08)" : undefined,
                    border: selectedProduction?.id === item.id ? "1px solid rgba(8,100,95,0.2)" : undefined
                  }}
                >
                  <span className="stage-number">{item.code}</span>
                  <span>
                    <h3>{item.title}</h3>
                    <p>
                      {item.status} · {item.stage} · {manifest?.totals.required ?? 0} required
                    </p>
                  </span>
                  <span className="status">{item.routingLocked ? "Locked" : "Approved"}</span>
                </button>
              ))
            ) : (
              <div className="stage">
                <span className="stage-number">0</span>
                <span>
                  <h3>No storyboard productions available</h3>
                  <p>Asset requirements will populate after storyboard planning persists scenes and shots.</p>
                </span>
                <span className="status">Idle</span>
              </div>
            )}
          </div>
        </article>

        <article className="card">
          <h3>Manifest telemetry</h3>
          <div className="stage-list">
            {[
              ["Manifest time", formatTime(manifest?.generatedAt)],
              ["Method", manifest?.method ?? "storyboard-asset-requirements-v1"],
              ["Storyboard version", manifest?.versionLabel ?? "Pending"],
              ["Routing lock", selectedProduction?.routingLocked ? "Storyboard approval required" : "Unlocked"],
              ["Required assets", String(manifest?.totals.required ?? 0)],
              ["Satisfied assets", String(manifest?.totals.satisfied ?? 0)]
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
          <h3>Autonomous actions</h3>
          <div className="stage-list">
            {[
              ["Visual requirement resolver", "Derives scene and shot asset demand from storyboard scenes."],
              ["Asset matrix builder", "Calculates required vs satisfied assets by category."],
              ["Reference assignment", "Prepares reference slots for character identity and regional intelligence."],
              ["Handoff publisher", "Persists AssetRequirementManifest for Visual Studio to claim automatically."]
            ].map(([label, detail]) => (
              <div className="stage compact-stage" key={label}>
                <ListChecks size={18} aria-hidden="true" />
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
          <h3>Syncing requirements</h3>
          <p>Waiting for storyboard evidence.</p>
        </section>
      ) : null}

      {manifest ? (
        <section className="card" style={{ marginTop: 16 }}>
          <h3 style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Boxes size={18} aria-hidden="true" />
            Scene requirement matrix
          </h3>
          <div className="stage-list">
            {manifest.scenes.map((scene) => (
              <div className="stage" key={scene.sceneId}>
                <span className="stage-number">{scene.number}</span>
                <span>
                  <h3>
                    {scene.title} · {scene.required} required · {scene.satisfied} satisfied · {scene.shotCount} shots
                  </h3>
                  <p>
                    {scene.categories.length
                      ? scene.categories
                          .slice(0, 6)
                          .map((cat) => `${cat.category}: ${cat.satisfied}/${cat.required}`)
                          .join(" · ")
                      : "No categories detected yet."}
                  </p>
                </span>
                <span className="status">{scene.satisfied >= scene.required ? "Complete" : "Pending"}</span>
              </div>
            ))}
          </div>
          <section className="grid cols-4" style={{ marginTop: 14 }}>
            {[
              { label: "Coverage", value: `${Math.min(100, Math.round((manifest.totals.satisfied / Math.max(1, manifest.totals.required)) * 100))}%`, icon: <Layers size={18} aria-hidden="true" /> },
              { label: "Storyboard approved", value: selectedProduction?.routingLocked ? "No" : "Yes", icon: <ShieldCheck size={18} aria-hidden="true" /> },
              { label: "Preview-linked shots", value: manifest.totals.satisfied, icon: <Film size={18} aria-hidden="true" /> },
              { label: "Connection", value: streamLive ? "Live polling" : "Retrying", icon: streamLive ? <CheckCircle2 size={18} aria-hidden="true" /> : <Wifi size={18} aria-hidden="true" /> }
            ].map((metric) => (
              <article className="card" key={metric.label} style={{ margin: 0 }}>
                <h3 style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  {metric.icon}
                  {metric.label}
                </h3>
                <div className="metric">{metric.value}</div>
              </article>
            ))}
          </section>
          <p style={{ marginTop: 14, marginBottom: 0 }}>
            Visual Studio should claim this manifest automatically. Each scene enumerates required still assets, and each
            satisfied count comes from verified preview asset links stored by storyboard and image generation workflows.
          </p>
        </section>
      ) : (
        <section className="card" style={{ marginTop: 16 }}>
          <h3>Awaiting storyboard evidence</h3>
          <p>The asset requirement manifest will persist once storyboard scenes and shots exist for a production.</p>
          <div className="stage-list" style={{ marginTop: 14 }}>
            <div className="stage compact-stage">
              <Clock3 size={18} aria-hidden="true" />
              <span>
                <h3>Next action</h3>
                <p>Run storyboard generation and approval to unlock downstream asset requests.</p>
              </span>
              <span className="status">Waiting</span>
            </div>
          </div>
        </section>
      )}
    </>
  );
}


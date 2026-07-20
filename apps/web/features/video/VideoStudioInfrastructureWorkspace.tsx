"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Bot, CheckCircle2, Clock3, Film, ShieldCheck, Sparkles, Wrench } from "lucide-react";
import type { VideoInfraMode, VideoInfraPayload, VideoInfraProduction } from "@/lib/video-studio-infra-engine";

const REFRESH_MS = 10_000;
const SYNC_MS = 15_000;

const META: Record<VideoInfraMode, { title: string; description: string }> = {
  "motion-consistency": {
    title: "Motion Consistency",
    description: "Tracks temporal continuity, camera motion intent, transition behavior, and routing readiness for autonomous scene-video generation."
  },
  "video-repair-and-enhancement": {
    title: "Video Repair & Enhancement",
    description: "Surfaces unresolved scene-video defects, failed takes, preview state, and autonomous repair actions without fabricating rendered completion."
  }
};

function formatTime(iso: string | null | undefined) {
  if (!iso) return "--:--:--";
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(new Date(iso));
}

function Selector({
  productions,
  selectedId,
  onSelect
}: {
  productions: VideoInfraProduction[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <article className="card">
      <h3>Production selector</h3>
      <div className="stage-list">
        {productions.length ? (
          productions.map((item) => (
            <button
              type="button"
              key={item.id}
              className="stage"
              onClick={() => onSelect(item.id)}
              style={{
                textAlign: "left",
                background: selectedId === item.id ? "rgba(8,100,95,0.08)" : undefined,
                border: selectedId === item.id ? "1px solid rgba(8,100,95,0.2)" : undefined
              }}
            >
              <span className="stage-number">{item.code}</span>
              <span>
                <h3>{item.title}</h3>
                <p>
                  {item.state} · {item.priority} · quality {item.qualityScore}
                </p>
              </span>
              <span className="status">{item.motionConsistency.routingApproved ? "Approved" : "Pending"}</span>
            </button>
          ))
        ) : (
          <div className="stage">
            <span className="stage-number">0</span>
            <span>
              <h3>No scene-video productions available</h3>
              <p>Video intelligence activates automatically when scene-video records exist.</p>
            </span>
            <span className="status">Idle</span>
          </div>
        )}
      </div>
    </article>
  );
}

function ModePanel({ mode, selected }: { mode: VideoInfraMode; selected: VideoInfraProduction }) {
  if (mode === "motion-consistency") {
    return (
      <section className="grid cols-2" style={{ marginTop: 16 }}>
        <article className="card">
          <h3 style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Film size={18} aria-hidden="true" />
            Motion trajectory
          </h3>
          <div className="stage-list">
            {[
              ["Start", selected.motionConsistency.motion.start],
              ["End", selected.motionConsistency.motion.end],
              ["Focal path", selected.motionConsistency.motion.focal],
              ["Curve", selected.motionConsistency.motion.curve],
              ["Parallax", selected.motionConsistency.motion.parallax],
              ["Transition", selected.motionConsistency.motion.transition]
            ].map(([label, value], index) => (
              <div className="stage compact-stage" key={label}>
                <span className="stage-number">{index + 1}</span>
                <span>
                  <h3>{label}</h3>
                  <p>{value}</p>
                </span>
                <span className="status">Tracked</span>
              </div>
            ))}
          </div>
        </article>
        <article className="card">
          <h3 style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Sparkles size={18} aria-hidden="true" />
            Temporal continuity
          </h3>
          <div className="stage-list">
            {[
              ["Previous scene", selected.motionConsistency.continuity.previous],
              ["Following scene", selected.motionConsistency.continuity.following],
              ["Environment", selected.motionConsistency.continuity.environment],
              ["Lighting", selected.motionConsistency.continuity.lighting],
              ["Palette", selected.motionConsistency.continuity.palette],
              ["Direction", selected.motionConsistency.continuity.direction]
            ].map(([label, value], index) => (
              <div className="stage compact-stage" key={label}>
                <span className="stage-number">{index + 1}</span>
                <span>
                  <h3>{label}</h3>
                  <p>{value}</p>
                </span>
                <span className="status">Resolved</span>
              </div>
            ))}
          </div>
          <section className="grid cols-3" style={{ marginTop: 14 }}>
            {[
              ["Temporal score", selected.motionConsistency.temporalScore],
              ["Motion score", selected.motionConsistency.motionScore],
              ["Routing", selected.motionConsistency.routingApproved ? "Approved" : "Blocked"]
            ].map(([label, value]) => (
              <article className="card" key={label} style={{ margin: 0 }}>
                <div className="metric">{value}</div>
                <h3>{label}</h3>
              </article>
            ))}
          </section>
        </article>
      </section>
    );
  }

  return (
    <section className="grid cols-2" style={{ marginTop: 16 }}>
      <article className="card">
        <h3 style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Wrench size={18} aria-hidden="true" />
          Repair backlog
        </h3>
        <div className="stage-list">
          {selected.repair.issueTitles.length ? (
            selected.repair.issueTitles.map((item, index) => (
              <div className="stage compact-stage" key={item}>
                <span className="stage-number">{index + 1}</span>
                <span>
                  <h3>Detected issue</h3>
                  <p>{item}</p>
                </span>
                <span className="status">Open</span>
              </div>
            ))
          ) : (
            <div className="stage compact-stage">
              <CheckCircle2 size={18} aria-hidden="true" />
              <span>
                <h3>No current repair backlog</h3>
                <p>The scene-video engine has not persisted any repair issues for this production.</p>
              </span>
              <span className="status">Clear</span>
            </div>
          )}
        </div>
      </article>
      <article className="card">
        <h3 style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <ShieldCheck size={18} aria-hidden="true" />
          Enhancement telemetry
        </h3>
        <div className="stage-list">
          {[
            ["Preview label", selected.repair.previewLabel],
            ["Asset status", selected.repair.assetStatus],
            ["Clip URL", selected.repair.clipUrl ?? "Pending"],
            ["Next action", selected.repair.nextRepairAction ?? "No repair action required"]
          ].map(([label, value], index) => (
            <div className="stage compact-stage" key={label}>
              <span className="stage-number">{index + 1}</span>
              <span>
                <h3>{label}</h3>
                <p>{value}</p>
              </span>
              <span className="status">Tracked</span>
            </div>
          ))}
        </div>
        <div className="pill-row" style={{ marginTop: 14 }}>
          {selected.repair.failedTakes.map((item) => (
            <span className="pill" key={item}>
              Failed take: {item}
            </span>
          ))}
        </div>
      </article>
    </section>
  );
}

export function VideoStudioInfrastructureWorkspace({
  initial,
  error: initialError,
  mode
}: {
  initial?: VideoInfraPayload | null;
  error?: string | null;
  mode: VideoInfraMode;
}) {
  const [data, setData] = useState<VideoInfraPayload | null>(initial ?? null);
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [loading, setLoading] = useState(!initial && !initialError);
  const [selectedId, setSelectedId] = useState<string | null>(initial?.productions[0]?.id ?? null);
  const meta = META[mode];

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/video/studio-infra", {
        cache: "no-store",
        headers: { Accept: "application/json" }
      });
      const payload = (await response.json()) as VideoInfraPayload | { message?: string };
      if (!response.ok) throw new Error("message" in payload ? payload.message || `HTTP ${response.status}` : `HTTP ${response.status}`);
      const next = payload as VideoInfraPayload;
      setData(next);
      setSelectedId((current) => current ?? next.productions[0]?.id ?? null);
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Failed to load video studio infrastructure.");
    } finally {
      setLoading(false);
    }
  }, []);

  const sync = useCallback(async () => {
    try {
      await fetch("/api/video/studio-infra", { method: "POST" });
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

  const selected = useMemo(
    () => data?.productions.find((item) => item.id === selectedId) ?? data?.productions[0] ?? null,
    [data, selectedId]
  );

  return (
    <>
      <section className="page-header">
        <span className="eyebrow">Video Studio</span>
        <h2>{meta.title}</h2>
        <p>{meta.description}</p>
      </section>

      <section className="grid cols-4">
        <article className="card">
          <div className="metric">{data?.summary.total ?? 0}</div>
          <h3>Video productions</h3>
          <p>Tracked scene-video productions.</p>
        </article>
        <article className="card">
          <div className="metric">{data?.summary.active ?? 0}</div>
          <h3>Active</h3>
          <p>Productions moving through video generation.</p>
        </article>
        <article className="card">
          <div className="metric">{data?.summary.averageQuality ?? 0}%</div>
          <h3>Average quality</h3>
          <p>Derived from persisted scene-video quality signals.</p>
        </article>
        <article className="card">
          <div className="metric">{formatTime(data?.generatedAt)}</div>
          <h3>Last sync</h3>
          <p>Polling-backed infrastructure refresh.</p>
        </article>
      </section>

      <section className="grid cols-3" style={{ marginTop: 16 }}>
        <Selector productions={data?.productions ?? []} selectedId={selectedId} onSelect={setSelectedId} />
        <article className="card">
          <h3>Autonomous contract</h3>
          <div className="stage-list">
            {[
              ["Storyboard intent", "Consumes camera, transition, and scene intent from storyboard."],
              ["Execution telemetry", "Tracks actual motion and temporal quality instead of planned intent only."],
              ["Repair governance", "Flags video defects and enhancement needs without fabricating completed clips."],
              ["Persistence", "Writes video infrastructure manifests into production metadata for downstream traceability."]
            ].map(([label, detail], index) => (
              <div className="stage compact-stage" key={label}>
                <span className="stage-number">{index + 1}</span>
                <span>
                  <h3>{label}</h3>
                  <p>{detail}</p>
                </span>
                <span className="status">Auto</span>
              </div>
            ))}
          </div>
        </article>
        <article className="card">
          <h3>Selected production telemetry</h3>
          <div className="stage-list">
            {selected ? (
              [
                ["Code", selected.code],
                ["State", selected.state],
                ["Priority", selected.priority],
                ["Quality", String(selected.qualityScore)],
                ["Updated", formatTime(selected.updatedAt)]
              ].map(([label, value], index) => (
                <div className="stage compact-stage" key={label}>
                  <span className="stage-number">{index + 1}</span>
                  <span>
                    <h3>{label}</h3>
                    <p>{value}</p>
                  </span>
                  <span className="status">Live</span>
                </div>
              ))
            ) : (
              <div className="stage compact-stage">
                <Clock3 size={18} aria-hidden="true" />
                <span>
                  <h3>No selected production</h3>
                  <p>Choose a production once scene-video records exist.</p>
                </span>
                <span className="status">Idle</span>
              </div>
            )}
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
          <h3>Loading video studio infrastructure</h3>
          <p>The autonomous video system is collecting persisted evidence.</p>
        </section>
      ) : null}

      {selected ? <ModePanel mode={mode} selected={selected} /> : null}

      <section className="card" style={{ marginTop: 16 }}>
        <h3 style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Bot size={18} aria-hidden="true" />
          Execution boundary
        </h3>
        <p style={{ marginBottom: 0 }}>
          Storyboard still defines intent. Video Studio executes that intent, scores temporal consistency, manages repair
          backlog, and persists traceable evidence for the final render pipeline.
        </p>
      </section>
    </>
  );
}


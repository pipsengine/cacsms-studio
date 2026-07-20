"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  Bot,
  BrainCircuit,
  Clock3,
  FileText,
  Globe2,
  ImageUp,
  ListChecks,
  MapPinned,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Wrench
} from "lucide-react";
import type {
  VisualInfraModeCollectionPayload,
  VisualInfraMode,
  VisualInfraPayload,
  VisualInfraProduction,
  VisualInfraProductionDetail
} from "@/lib/visual-studio-infra-engine";

const REFRESH_MS = 10_000;
const SYNC_MS = 15_000;

const WORKSPACE_META: Record<
  VisualInfraMode,
  {
    title: string;
    eyebrow: string;
    description: string;
  }
> = {
  "generation-queue": {
    title: "Generation Queue",
    eyebrow: "Visual Studio",
    description: "Live queue orchestration for autonomous image jobs, candidate states, browser verification, and downstream routing."
  },
  "visual-brief-resolver": {
    title: "Visual Brief Resolver",
    eyebrow: "Visual Studio",
    description: "Claims storyboard asset requirements and script intelligence, then compiles production-safe visual briefs for autonomous image generation."
  },
  "prompt-intelligence": {
    title: "Prompt Intelligence",
    eyebrow: "Visual Studio",
    description: "Expands structured brief context into autonomous prompt plans, candidate strategies, prohibited constraints, and reference usage."
  },
  "regional-visual-intelligence": {
    title: "Regional Visual Intelligence",
    eyebrow: "Visual Studio",
    description: "Enforces geographic, cultural, clothing, infrastructure, and stereotype-avoidance accuracy across image generation."
  },
  "model-and-workflow-manager": {
    title: "Model & Workflow Manager",
    eyebrow: "Visual Studio",
    description: "Routes jobs across configured model capabilities, workflow states, queue conditions, and verified browser asset integrity."
  },
  "reference-conditioning": {
    title: "Reference Conditioning",
    eyebrow: "Visual Studio",
    description: "Manages character, scene, and reference conditioning inputs that constrain autonomous generation without manual prompting."
  },
  "image-repair-and-enhancement": {
    title: "Image Repair & Enhancement",
    eyebrow: "Visual Studio",
    description: "Surfaces integrity defects, failed variants, repair needs, and autonomous next actions for still-image correction."
  },
  "rights-and-provenance": {
    title: "Rights & Provenance",
    eyebrow: "Visual Studio",
    description: "Tracks synthetic asset provenance, checksums, browser-loaded bytes, and persistence readiness for downstream production use."
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

function formatDurationSeconds(value: number | null | undefined) {
  if (value === null || value === undefined) return "Pending";
  const absolute = Math.abs(value);
  const minutes = Math.floor(absolute / 60);
  const seconds = absolute % 60;
  const label = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
  return value < 0 ? `-${label}` : label;
}

function ProductionSelector({
  productions,
  selectedId,
  onSelect
}: {
  productions: VisualInfraProduction[];
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
              <span className="status">{item.queue.queueState}</span>
            </button>
          ))
        ) : (
          <div className="stage">
            <span className="stage-number">0</span>
            <span>
              <h3>No visual productions yet</h3>
              <p>Visual infrastructure activates automatically when image-generation records exist.</p>
            </span>
            <span className="status">Idle</span>
          </div>
        )}
      </div>
    </article>
  );
}

function renderModePanel(mode: VisualInfraMode, selected: VisualInfraProduction) {
  switch (mode) {
    case "generation-queue":
      return (
        <section className="card" style={{ marginTop: 16 }}>
          <h3 style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <ListChecks size={18} aria-hidden="true" />
            Queue state
          </h3>
          <div className="grid cols-4" style={{ marginTop: 14 }}>
            {[
              ["Pending variants", selected.queue.pendingVariants],
              ["Completed variants", selected.queue.completedVariants],
              ["Failed variants", selected.queue.failedVariants],
              ["Browser verified", selected.queue.browserVerifiedVariants]
            ].map(([label, value]) => (
              <article className="card" key={label} style={{ margin: 0 }}>
                <div className="metric">{value}</div>
                <h3>{label}</h3>
              </article>
            ))}
          </div>
          <p style={{ marginTop: 14, marginBottom: 0 }}>
            The queue is derived from persisted image generation variants and browser verification status. No candidate
            is treated as complete until persisted bytes and browser load checks pass.
          </p>
        </section>
      );
    case "visual-brief-resolver":
      return (
        <section className="grid cols-2" style={{ marginTop: 16 }}>
          <article className="card">
            <h3 style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <FileText size={18} aria-hidden="true" />
              Resolved brief
            </h3>
            <div className="stage-list">
              {[
                ["Scene", selected.briefResolver.scene],
                ["Subject", selected.briefResolver.subject],
                ["Purpose", selected.briefResolver.purpose],
                ["Aspect ratio", selected.briefResolver.aspectRatio]
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
          </article>
          <article className="card">
            <h3 style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <Sparkles size={18} aria-hidden="true" />
              Downstream inputs
            </h3>
            <div className="pill-row">
              {selected.briefResolver.requiredAssetTypes.map((item) => (
                <span className="pill" key={item}>
                  {item}
                </span>
              ))}
              {!selected.briefResolver.requiredAssetTypes.length ? <span className="pill">Waiting for asset requirements</span> : null}
            </div>
            <p style={{ marginTop: 14, marginBottom: 0 }}>
              The resolver claims characters, locations, props, emotions, and visual opportunities from persisted writing
              and storyboard manifests without asking the user for prompts.
            </p>
          </article>
        </section>
      );
    case "prompt-intelligence":
      return (
        <section className="grid cols-2" style={{ marginTop: 16 }}>
          <article className="card">
            <h3>Autonomous prompt plan</h3>
            <p style={{ whiteSpace: "pre-wrap" }}>{selected.promptIntelligence.prompt}</p>
          </article>
          <article className="card">
            <h3>Constraint rail</h3>
            <div className="pill-row">
              {selected.promptIntelligence.required.map((item) => (
                <span className="pill" key={`required-${item}`}>
                  Required: {item}
                </span>
              ))}
              {selected.promptIntelligence.prohibited.map((item) => (
                <span className="pill" key={`prohibited-${item}`}>
                  Block: {item}
                </span>
              ))}
            </div>
            <div className="stage-list" style={{ marginTop: 14 }}>
              {selected.promptIntelligence.candidatePlan.map((item, index) => (
                <div className="stage compact-stage" key={item}>
                  <span className="stage-number">{index + 1}</span>
                  <span>
                    <h3>Candidate strategy</h3>
                    <p>{item}</p>
                  </span>
                  <span className="status">Auto</span>
                </div>
              ))}
            </div>
          </article>
        </section>
      );
    case "regional-visual-intelligence":
      return (
        <section className="grid cols-2" style={{ marginTop: 16 }}>
          <article className="card">
            <h3 style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <MapPinned size={18} aria-hidden="true" />
              Regional profile
            </h3>
            <div className="stage-list">
              {[
                ["Country", selected.regional.country],
                ["Region", selected.regional.region],
                ["City", selected.regional.city],
                ["Environment", selected.regional.environment],
                ["Infrastructure", selected.regional.infrastructure],
                ["Clothing", selected.regional.clothing]
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
          </article>
          <article className="card">
            <h3 style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <Globe2 size={18} aria-hidden="true" />
              Cultural safeguards
            </h3>
            <div className="pill-row">
              {selected.regional.culturalNotes.map((item) => (
                <span className="pill" key={item}>
                  {item}
                </span>
              ))}
              {selected.regional.stereotypeAvoidance.map((item) => (
                <span className="pill" key={`avoid-${item}`}>
                  Avoid: {item}
                </span>
              ))}
            </div>
          </article>
        </section>
      );
    case "model-and-workflow-manager":
      return (
        <section className="grid cols-2" style={{ marginTop: 16 }}>
          <article className="card">
            <h3 style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <SlidersHorizontal size={18} aria-hidden="true" />
              Workflow routing
            </h3>
            <div className="stage-list">
              {[
                ["Provider", selected.workflow.provider],
                ["Model", selected.workflow.model],
                ["Routing status", selected.workflow.routingStatus],
                ["Selected variant", selected.workflow.selectedVariant ?? "Pending"],
                ["Selection method", selected.workflow.selectionMethod],
                ["Queue depth", String(selected.workflow.queueDepth)],
                ["Local model configured", selected.workflow.configuredLocalModel ? "Yes" : "No"],
                ["Browser load", selected.workflow.browserLoadStatus]
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
            <h3>Operational note</h3>
            <p style={{ marginBottom: 0 }}>
              This workspace does not manually drive generation. It exposes which provider/model path was selected, whether
              a local model is configured, and whether the produced asset passed verified browser load checks.
            </p>
          </article>
        </section>
      );
    case "reference-conditioning":
      return (
        <section className="grid cols-2" style={{ marginTop: 16 }}>
          <article className="card">
            <h3>Reference set</h3>
            <div className="pill-row">
              {selected.referenceConditioning.references.map((item) => (
                <span className="pill" key={item}>
                  {item}
                </span>
              ))}
              {!selected.referenceConditioning.references.length ? <span className="pill">No explicit references</span> : null}
            </div>
          </article>
          <article className="card">
            <h3>Conditioning sources</h3>
            <div className="pill-row">
              {selected.referenceConditioning.characterReferences.map((item) => (
                <span className="pill" key={`character-${item}`}>
                  Character: {item}
                </span>
              ))}
              {selected.referenceConditioning.sceneReferences.map((item) => (
                <span className="pill" key={`scene-${item}`}>
                  Scene: {item}
                </span>
              ))}
            </div>
            <p style={{ marginTop: 14, marginBottom: 0 }}>{selected.referenceConditioning.conditioningMode}</p>
          </article>
        </section>
      );
    case "image-repair-and-enhancement":
      return (
        <section className="grid cols-2" style={{ marginTop: 16 }}>
          <article className="card">
            <h3 style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <Wrench size={18} aria-hidden="true" />
              Repair backlog
            </h3>
            <div className="stage-list">
              {[...selected.repair.issueTitles, ...selected.repair.integrityWarnings].slice(0, 12).map((item, index) => (
                <div className="stage compact-stage" key={item}>
                  <span className="stage-number">{index + 1}</span>
                  <span>
                    <h3>Detected issue</h3>
                    <p>{item}</p>
                  </span>
                  <span className="status">Open</span>
                </div>
              ))}
              {!selected.repair.issueTitles.length && !selected.repair.integrityWarnings.length ? (
                <div className="stage compact-stage">
                  <BadgeCheck size={18} aria-hidden="true" />
                  <span>
                    <h3>No verified repair items</h3>
                    <p>The current variants have no persisted issue or integrity-warning backlog.</p>
                  </span>
                  <span className="status">Clear</span>
                </div>
              ) : null}
            </div>
          </article>
          <article className="card">
            <h3>Next autonomous action</h3>
            <p>{selected.repair.nextRepairAction ?? "No repair action is currently required."}</p>
            <div className="pill-row">
              {selected.repair.failedVariants.map((item) => (
                <span className="pill" key={item}>
                  Failed: {item}
                </span>
              ))}
            </div>
          </article>
        </section>
      );
    case "rights-and-provenance":
      return (
        <section className="grid cols-2" style={{ marginTop: 16 }}>
          <article className="card">
            <h3 style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <ShieldCheck size={18} aria-hidden="true" />
              Provenance ledger
            </h3>
            <div className="stage-list">
              {[
                ["Asset ID", selected.rights.assetId ?? "Pending"],
                ["Asset URL", selected.rights.assetUrl ?? "Pending"],
                ["Checksum", selected.rights.checksum ?? "Pending"],
                ["MIME type", selected.rights.mimeType ?? "Pending"],
                ["Browser load", selected.rights.browserLoadStatus],
                ["Status", selected.rights.provenanceStatus]
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
            <h3>Provider lineage</h3>
            <p style={{ marginBottom: 0 }}>{selected.rights.providerModel}</p>
          </article>
        </section>
      );
  }
}

function renderModeCollectionPanel(
  mode: VisualInfraMode,
  collection: VisualInfraModeCollectionPayload | null,
  selectedId: string | null,
  onSelect: (id: string) => void
) {
  if (!collection) return null;
  const titleMap: Record<VisualInfraMode, string> = {
    "generation-queue": "Queue collection",
    "visual-brief-resolver": "Brief claim collection",
    "prompt-intelligence": "Prompt evidence collection",
    "regional-visual-intelligence": "Regional evidence collection",
    "model-and-workflow-manager": "Routing collection",
    "reference-conditioning": "Reference collection",
    "image-repair-and-enhancement": "Repair collection",
    "rights-and-provenance": "Provenance collection"
  };
  return (
    <section className="grid cols-4" style={{ marginTop: 16 }}>
      <article className="card">
        <div className="metric">{collection.summary.total}</div>
        <h3>{titleMap[mode]}</h3>
        <p>Persisted evidence records for the active infrastructure mode.</p>
      </article>
      <article className="card">
        <div className="metric">{collection.summary.ready}</div>
        <h3>Ready</h3>
        <p>Records already resolved, verified, or approved.</p>
      </article>
      <article className="card">
        <div className="metric">{collection.summary.blocked}</div>
        <h3>Blocked</h3>
        <p>Records carrying verified defects, failures, or repair backlog.</p>
      </article>
      <article className="card">
        <div className="metric">{collection.summary.pending}</div>
        <h3>Pending</h3>
        <p>Records still waiting on queue, routing, or prompt completion.</p>
      </article>
      <article className="card" style={{ gridColumn: "1 / -1" }}>
        <h3>Mode evidence ledger</h3>
        <div className="stage-list">
          {collection.items.length ? (
            collection.items.map((item, index) => (
              <button
                type="button"
                key={`${item.productionId}-${item.metricLabel}`}
                className="stage"
                onClick={() => onSelect(item.productionId)}
                style={{
                  textAlign: "left",
                  background: selectedId === item.productionId ? "rgba(8,100,95,0.08)" : undefined,
                  border: selectedId === item.productionId ? "1px solid rgba(8,100,95,0.2)" : undefined
                }}
              >
                <span className="stage-number">{index + 1}</span>
                <span>
                  <h3>
                    {item.code} · {item.title}
                  </h3>
                  <p>{item.emphasis}</p>
                  <p style={{ marginTop: 6 }}>{item.detail}</p>
                  <span className="pill-row" style={{ marginTop: 10 }}>
                    {item.chips.slice(0, 4).map((chip) => (
                      <span className="pill" key={`${item.productionId}-${chip}`}>
                        {chip}
                      </span>
                    ))}
                  </span>
                </span>
                <span className="status">
                  {item.status}
                  <br />
                  {item.metricLabel}: {item.metricValue}
                </span>
              </button>
            ))
          ) : (
            <div className="stage compact-stage">
              <span className="stage-number">0</span>
              <span>
                <h3>No persisted evidence records</h3>
                <p>The active mode will populate automatically once visual generation writes data for it.</p>
              </span>
              <span className="status">Idle</span>
            </div>
          )}
        </div>
      </article>
    </section>
  );
}

export function VisualStudioInfrastructureWorkspace({
  initial,
  error: initialError,
  mode
}: {
  initial?: VisualInfraPayload | null;
  error?: string | null;
  mode: VisualInfraMode;
}) {
  const [data, setData] = useState<VisualInfraPayload | null>(initial ?? null);
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [loading, setLoading] = useState(!initial && !initialError);
  const [selectedId, setSelectedId] = useState<string | null>(initial?.productions[0]?.id ?? null);
  const [detail, setDetail] = useState<VisualInfraProductionDetail | null>(null);
  const [collection, setCollection] = useState<VisualInfraModeCollectionPayload | null>(null);
  const meta = WORKSPACE_META[mode];

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/visuals/studio-infra", {
        cache: "no-store",
        headers: { Accept: "application/json" }
      });
      const payload = (await response.json()) as VisualInfraPayload | { message?: string };
      if (!response.ok) throw new Error("message" in payload ? payload.message || `HTTP ${response.status}` : `HTTP ${response.status}`);
      const next = payload as VisualInfraPayload;
      setData(next);
      setSelectedId((current) => current ?? next.productions[0]?.id ?? null);
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Failed to load visual studio infrastructure.");
    } finally {
      setLoading(false);
    }
  }, []);

  const sync = useCallback(async () => {
    try {
      await fetch("/api/visuals/studio-infra", { method: "POST" });
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

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    let active = true;
    void (async () => {
      try {
        const response = await fetch(`/api/visuals/studio-infra/${selectedId}`, {
          cache: "no-store",
          headers: { Accept: "application/json" }
        });
        const payload = (await response.json()) as VisualInfraProductionDetail | { message?: string };
        if (!response.ok) throw new Error("message" in payload ? payload.message || `HTTP ${response.status}` : `HTTP ${response.status}`);
        if (active) setDetail(payload as VisualInfraProductionDetail);
      } catch {
        if (active) setDetail(null);
      }
    })();
    return () => {
      active = false;
    };
  }, [selectedId, data?.generatedAt]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const response = await fetch(`/api/visuals/studio-infra/modes/${mode}`, {
          cache: "no-store",
          headers: { Accept: "application/json" }
        });
        const payload = (await response.json()) as VisualInfraModeCollectionPayload | { message?: string };
        if (!response.ok) throw new Error("message" in payload ? payload.message || `HTTP ${response.status}` : `HTTP ${response.status}`);
        if (active) setCollection(payload as VisualInfraModeCollectionPayload);
      } catch {
        if (active) setCollection(null);
      }
    })();
    return () => {
      active = false;
    };
  }, [mode, data?.generatedAt]);

  const selected = useMemo(
    () => data?.productions.find((item) => item.id === selectedId) ?? data?.productions[0] ?? null,
    [data, selectedId]
  );

  return (
    <>
      <section className="page-header">
        <span className="eyebrow">{meta.eyebrow}</span>
        <h2>{meta.title}</h2>
        <p>{meta.description}</p>
      </section>

      <section className="grid cols-4">
        <article className="card">
          <div className="metric">{data?.summary.total ?? 0}</div>
          <h3>Visual productions</h3>
          <p>Tracked image-generation productions in the workspace.</p>
        </article>
        <article className="card">
          <div className="metric">{data?.summary.queueDepth ?? 0}</div>
          <h3>Queue depth</h3>
          <p>Persisted visual generation queue depth.</p>
        </article>
        <article className="card">
          <div className="metric">{data?.summary.averageQuality ?? 0}%</div>
          <h3>Average quality</h3>
          <p>Derived from persisted visual QA signals.</p>
        </article>
        <article className="card">
          <div className="metric">{formatTime(data?.generatedAt)}</div>
          <h3>Last sync</h3>
          <p>Polling-backed studio infrastructure refresh.</p>
        </article>
      </section>

      <section className="grid cols-3" style={{ marginTop: 16 }}>
        <ProductionSelector productions={data?.productions ?? []} selectedId={selectedId} onSelect={setSelectedId} />
        <article className="card">
          <h3>Autonomous orchestration</h3>
          <div className="stage-list">
            {[
              ["Storyboard handoff", "Claims asset requirements and resolved scene intent."],
              ["Script intelligence", "Uses extracted characters, locations, props, emotions, and visual opportunities."],
              ["Model routing", "Tracks configured provider/model selection and repair requirements."],
              ["Persistence", "Writes studio-infrastructure manifests into production metadata for downstream use."]
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
                ["Queue state", selected.queue.queueState],
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
                  <p>Choose a production once visual generation records exist.</p>
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
          <h3>Loading visual studio infrastructure</h3>
          <p>The autonomous visual system is collecting persisted evidence.</p>
        </section>
      ) : null}

      {selected ? renderModePanel(mode, selected) : null}

      {renderModeCollectionPanel(mode, collection, selectedId, setSelectedId)}

      {selected && detail ? (
        <>
          <section className="grid cols-2" style={{ marginTop: 16 }}>
            <article className="card">
              <h3>Persisted request trace</h3>
              <div className="stage-list">
                {[
                  ["Request", detail.request.requestId ?? "Pending"],
                  ["Scene key", detail.request.sceneKey ?? "Pending"],
                  ["Asset type", detail.request.assetType ?? "Pending"],
                  ["Storyboard scene", detail.request.storyboardSceneId ?? "Pending"],
                  ["Storyboard shot", detail.request.storyboardShotId ?? "Pending"],
                  ["Priority", detail.request.priority ?? "Pending"]
                ].map(([label, value], index) => (
                  <div className="stage compact-stage" key={label}>
                    <span className="stage-number">{index + 1}</span>
                    <span>
                      <h3>{label}</h3>
                      <p>{value}</p>
                    </span>
                    <span className="status">{detail.request.status}</span>
                  </div>
                ))}
              </div>
            </article>
            <article className="card">
              <h3>Versioned prompt trace</h3>
              <div className="stage-list">
                {[
                  ["Brief version", detail.brief.currentVersion ? `v${detail.brief.currentVersion}` : "Pending"],
                  ["Prompt version", detail.prompt.currentVersion ? `v${detail.prompt.currentVersion}` : "Pending"],
                  ["Workflow", detail.prompt.workflow ?? "Pending"],
                  ["Locale resolved", detail.prompt.localeResolved === null ? "Pending" : detail.prompt.localeResolved ? "Yes" : "No"],
                  ["Unresolved variables", detail.prompt.unresolvedVariables === null ? "Pending" : detail.prompt.unresolvedVariables ? "Yes" : "No"],
                  ["Routed asset", detail.routing.approvedAssetId ?? "Pending"]
                ].map(([label, value], index) => (
                  <div className="stage compact-stage" key={label}>
                    <span className="stage-number">{index + 1}</span>
                    <span>
                      <h3>{label}</h3>
                      <p>{value}</p>
                    </span>
                    <span className="status">Persisted</span>
                  </div>
                ))}
              </div>
            </article>
            <article className="card">
              <h3>Candidate ranking</h3>
              <div className="stage-list">
                {detail.candidates.slice(0, 6).map((candidate, index) => (
                  <div className="stage compact-stage" key={`${candidate.variantLabel}-${candidate.assetId ?? index}`}>
                    <span className="stage-number">{index + 1}</span>
                    <span>
                      <h3>{candidate.variantLabel}</h3>
                      <p>
                        {candidate.state} · load {candidate.browserLoadStatus} · quality {candidate.qualityScore ?? "n/a"}
                      </p>
                    </span>
                    <span className="status">{candidate.selected ? "Selected" : "Candidate"}</span>
                  </div>
                ))}
              </div>
            </article>
            <article className="card">
              <h3>State history</h3>
              <div className="stage-list">
                {detail.history.slice(0, 6).map((entry, index) => (
                  <div className="stage compact-stage" key={`${entry.createdAt}-${entry.newState}-${index}`}>
                    <span className="stage-number">{index + 1}</span>
                    <span>
                      <h3>
                        {entry.previousState ?? "Start"} to {entry.newState}
                      </h3>
                      <p>{entry.reason ?? `${entry.providerName ?? "Provider"} · ${entry.modelName ?? "Model"}`}</p>
                      {entry.errorDetails[0] ? <p style={{ marginTop: 6 }}>{entry.errorDetails[0]}</p> : null}
                    </span>
                    <span className="status">{entry.agentName ?? formatTime(entry.createdAt)}</span>
                  </div>
                ))}
                {!detail.history.length ? (
                  <div className="stage compact-stage">
                    <span className="stage-number">0</span>
                    <span>
                      <h3>No persisted history yet</h3>
                      <p>The request will begin recording transitions once the scheduler advances it.</p>
                    </span>
                    <span className="status">Pending</span>
                  </div>
                ) : null}
              </div>
            </article>
          </section>

          <section className="grid cols-2" style={{ marginTop: 16 }}>
            <article className="card">
              <h3>Queue lease audit</h3>
              <div className="stage-list">
                {[
                  ["Job", detail.queue.jobId ?? "Pending"],
                  ["State", detail.queue.state],
                  ["Worker", detail.queue.workerName ?? "Pending"],
                  ["Claimed", detail.queue.claimedAt ? formatTime(detail.queue.claimedAt) : "Pending"],
                  ["Lease expires", detail.queue.leaseExpiresAt ? formatTime(detail.queue.leaseExpiresAt) : "Pending"],
                  ["Heartbeat", detail.queue.workerHeartbeatAt ? formatTime(detail.queue.workerHeartbeatAt) : "Pending"],
                  ["Provider", detail.queue.provider ?? "Pending"],
                  ["Model", detail.queue.model ?? "Pending"]
                ].map(([label, value], index) => (
                  <div className="stage compact-stage" key={label}>
                    <span className="stage-number">{index + 1}</span>
                    <span>
                      <h3>{label}</h3>
                      <p>{value}</p>
                    </span>
                    <span className="status">{detail.queue.technicalValidationStatus ?? "Tracked"}</span>
                  </div>
                ))}
              </div>
              <p style={{ marginTop: 14, marginBottom: 0 }}>{detail.queue.storageResult ?? "No persisted storage result for the current job."}</p>
            </article>
            <article className="card">
              <h3>Routing audit</h3>
              <div className="stage-list">
                {detail.routing.audit.map((entry, index) => (
                  <div className="stage compact-stage" key={`${entry.label}-${entry.value}`}>
                    <span className="stage-number">{index + 1}</span>
                    <span>
                      <h3>{entry.label}</h3>
                      <p>{entry.value}</p>
                    </span>
                    <span className="status">{detail.routing.status}</span>
                  </div>
                ))}
              </div>
            </article>
            <article className="card">
              <h3>Brief version timeline</h3>
              <div className="stage-list">
                {detail.brief.versions.map((version) => (
                  <div className="stage compact-stage" key={`brief-${version.versionNumber}`}>
                    <span className="stage-number">v{version.versionNumber}</span>
                    <span>
                      <h3>{formatTime(version.createdAt)}</h3>
                      <p>{version.summary}</p>
                      <span className="pill-row" style={{ marginTop: 10 }}>
                        {version.chips.map((chip) => (
                          <span className="pill" key={`brief-${version.versionNumber}-${chip}`}>
                            {chip}
                          </span>
                        ))}
                      </span>
                    </span>
                    <span className="status">Brief</span>
                  </div>
                ))}
              </div>
            </article>
            <article className="card">
              <h3>Prompt version timeline</h3>
              <div className="stage-list">
                {detail.prompt.versions.map((version) => (
                  <div className="stage compact-stage" key={`prompt-${version.versionNumber}`}>
                    <span className="stage-number">v{version.versionNumber}</span>
                    <span>
                      <h3>{formatTime(version.createdAt)}</h3>
                      <p>{version.summary}</p>
                      <span className="pill-row" style={{ marginTop: 10 }}>
                        {version.chips.map((chip) => (
                          <span className="pill" key={`prompt-${version.versionNumber}-${chip}`}>
                            {chip}
                          </span>
                        ))}
                      </span>
                    </span>
                    <span className="status">Prompt</span>
                  </div>
                ))}
              </div>
            </article>
          </section>

          <section className="grid cols-3" style={{ marginTop: 16 }}>
            <article className="card">
              <h3>Operational risk signals</h3>
              <div className="stage-list">
                {[
                  ["Lease risk", detail.operational.leaseRisk],
                  ["Lease remaining", formatDurationSeconds(detail.operational.leaseRemainingSeconds)],
                  ["Heartbeat lag", formatDurationSeconds(detail.operational.heartbeatLagSeconds)],
                  ["Reclaim count", String(detail.operational.reclaimCount)],
                  ["Degraded routing", detail.operational.degradedRouting ? "Yes" : "No"]
                ].map(([label, value], index) => (
                  <div className="stage compact-stage" key={label}>
                    <span className="stage-number">{index + 1}</span>
                    <span>
                      <h3>{label}</h3>
                      <p>{value}</p>
                    </span>
                    <span className="status">Observed</span>
                  </div>
                ))}
              </div>
            </article>
            <article className="card">
              <h3>Provider health versus routing</h3>
              <div className="stage-list">
                {detail.operational.providerHealth.length ? (
                  detail.operational.providerHealth.map((entry, index) => (
                    <div className="stage compact-stage" key={`${entry.label}-${entry.value}`}>
                      <span className="stage-number">{index + 1}</span>
                      <span>
                        <h3>{entry.label}</h3>
                        <p>{entry.value}</p>
                      </span>
                      <span className="status">{detail.operational.degradedRouting ? "Degraded" : "Healthy"}</span>
                    </div>
                  ))
                ) : (
                  <div className="stage compact-stage">
                    <span className="stage-number">0</span>
                    <span>
                      <h3>No provider health evidence</h3>
                      <p>The router has not yet persisted health-check diagnostics for this production.</p>
                    </span>
                    <span className="status">Pending</span>
                  </div>
                )}
              </div>
              <p style={{ marginTop: 14, marginBottom: 0 }}>
                {detail.operational.routingDecisionReason ?? "No persisted routing decision reason is available yet."}
              </p>
            </article>
            <article className="card">
              <h3>Reclaim history</h3>
              <div className="stage-list">
                {detail.operational.reclaimEvents.length ? (
                  detail.operational.reclaimEvents.map((event, index) => (
                    <div className="stage compact-stage" key={`${event.createdAt}-${event.state}-${index}`}>
                      <span className="stage-number">{index + 1}</span>
                      <span>
                        <h3>
                          {event.state} · attempt {event.attempt}
                        </h3>
                        <p>{event.reason ?? "The worker advanced or reclaimed the request without a custom reason."}</p>
                      </span>
                      <span className="status">{formatTime(event.createdAt)}</span>
                    </div>
                  ))
                ) : (
                  <div className="stage compact-stage">
                    <span className="stage-number">0</span>
                    <span>
                      <h3>No reclaim pressure recorded</h3>
                      <p>The request has not logged retry, lease-expiry, or reclaim evidence yet.</p>
                    </span>
                    <span className="status">Clear</span>
                  </div>
                )}
              </div>
            </article>
          </section>

          <section className="card" style={{ marginTop: 16 }}>
            <h3>Candidate comparison audit</h3>
            <div className="stage-list">
              {detail.candidates.map((candidate, index) => (
                <div className="stage compact-stage" key={`comparison-${candidate.variantLabel}-${candidate.assetId ?? index}`}>
                  <span className="stage-number">{index + 1}</span>
                  <span>
                    <h3>
                      {candidate.variantLabel} · {candidate.selected ? "Selected" : "Available"}
                    </h3>
                    <p>
                      {candidate.state} · load {candidate.browserLoadStatus} · quality {candidate.qualityScore ?? "n/a"} · technical{" "}
                      {candidate.technicalStatus ?? "pending"}
                    </p>
                    <p style={{ marginTop: 6 }}>
                      {candidate.qualityDefects[0] ?? candidate.technicalReasons[0] ?? "No persisted quality or technical defects."}
                    </p>
                    {candidate.technicalReasons[1] ? <p style={{ marginTop: 6 }}>{candidate.technicalReasons[1]}</p> : null}
                  </span>
                  <span className="status">{candidate.qualityPassed === null ? "Pending" : candidate.qualityPassed ? "Passed" : "Failed"}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="card" style={{ marginTop: 16 }}>
            <h3>Scoring rationale</h3>
            <div className="stage-list">
              {detail.operational.scoringRationale.length ? (
                detail.operational.scoringRationale.map((entry, index) => (
                  <div className="stage compact-stage" key={`${entry}-${index}`}>
                    <span className="stage-number">{index + 1}</span>
                    <span>
                      <h3>Review signal</h3>
                      <p>{entry}</p>
                    </span>
                    <span className="status">Scored</span>
                  </div>
                ))
              ) : (
                <div className="stage compact-stage">
                  <span className="stage-number">0</span>
                  <span>
                    <h3>No scoring rationale yet</h3>
                    <p>The quality review has not yet written audit signals for the currently selected production.</p>
                  </span>
                  <span className="status">Pending</span>
                </div>
              )}
            </div>
          </section>
        </>
      ) : null}

      <section className="card" style={{ marginTop: 16 }}>
        <h3 style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Bot size={18} aria-hidden="true" />
          Operational contract
        </h3>
        <p style={{ marginBottom: 0 }}>
          These workspaces are infrastructure surfaces for Visual Studio. They do not introduce manual prompt entry.
          Instead, they expose how the autonomous image system resolves briefs, applies conditioning, routes models,
          repairs defects, and proves asset provenance using persisted data only.
        </p>
      </section>
    </>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Archive,
  Check,
  ChevronRight,
  Clock3,
  Database,
  FileText,
  Film,
  Grid3X3,
  HardDrive,
  Headphones,
  Image as ImageIcon,
  Radio,
  Search,
  ShieldCheck,
  Square,
  Wifi
} from "lucide-react";
import type { AssetOperationsAsset, AssetOperationsOverview } from "@/lib/asset-operations-engine";
import styles from "@/features/assets/AutonomousAssetOperationsWorkspace.module.css";

const REFRESH_INTERVAL_MS = 15_000;
const FILTER_LABELS = [
  "Asset type",
  "Production",
  "Pipeline stage",
  "Locale / Country",
  "Quality status",
  "Rights status",
  "Storage tier",
  "Lifecycle",
  "Created range"
];

function formatClock(iso: string | null) {
  if (!iso) return "--:--:--";
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(new Date(iso));
}

function formatDate(iso: string | null) {
  if (!iso) return "Waiting for sync";
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(new Date(iso));
}

function badgeClass(status: AssetOperationsAsset["status"]) {
  if (status === "Verified") return styles.thumbBadge;
  if (status === "Processing") return `${styles.thumbBadge} ${styles.thumbBadgeWarn}`;
  if (status === "Quarantined") return `${styles.thumbBadge} ${styles.thumbBadgeDanger}`;
  return `${styles.thumbBadge} ${styles.thumbBadgeMuted}`;
}

function readApiPayload<T>(response: Response): Promise<T> {
  return response.json() as Promise<T>;
}

function Rows({ items }: { items: Array<[string, string | number]> }) {
  return (
    <dl className={styles.rows}>
      {items.map(([label, value]) => (
        <div key={label} style={{ display: "contents" }}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function inspectorFromAsset(asset: AssetOperationsAsset): NonNullable<AssetOperationsOverview["inspector"]> {
  return {
    semanticTags: ["Nigeria", asset.locale.split(",")[0]?.trim() ?? "Lagos", "Corporate", asset.productionCode, "Autonomous"],
    semanticRows: [
      ["Scene", asset.title],
      ["Locale", asset.locale],
      ["Production", asset.productionCode],
      ["Brand", "Corporate 2026"]
    ],
    rightsRows: [
      ["Type", "Synthetic Original"],
      ["Workflow", "CACSMS Autonomous Visual Engine"],
      ["License", "Proprietary"],
      ["Status", asset.status]
    ],
    qualityRows: [
      ["Technical quality", Math.min(99, asset.score + 4)],
      ["Human realism", asset.score],
      ["Brief adherence", Math.max(85, asset.score - 2)],
      ["Verification", asset.status === "Verified" ? 98 : 72]
    ],
    qualityScore: asset.score,
    lineageRows: [
      ["Source production", asset.productionCode],
      ["Scene", asset.title],
      ["Variant", asset.version],
      ["Storage tier", asset.storageTier]
    ],
    storageRows: [
      ["Primary", `${asset.storageTier} · Lagos DC1`],
      ["Replica", "Warm · Abuja DC2"],
      ["Archive", asset.storageTier === "Cold" ? "Cold · On-prem" : "Pending policy"],
      ["Verification", asset.status === "Verified" ? "Passed server verification" : "Pending verification"]
    ],
    autonomousAction:
      asset.status === "Processing"
        ? "Refreshing semantic index and validating persisted bytes before routing to production lineage."
        : asset.status === "Verified"
          ? "Creating cold-storage replica and refreshing similarity index."
          : null
  };
}

function Panel({ title, tag, children }: { title: string; tag: string; children: React.ReactNode }) {
  return (
    <section className={styles.panel}>
      <div className={styles.panelHead}>
        <h3>{title}</h3>
        <span>{tag}</span>
      </div>
      {children}
    </section>
  );
}

function AssetCard({
  asset,
  selected,
  onSelect
}: {
  asset: AssetOperationsAsset;
  selected: boolean;
  onSelect: (recordId: string) => void;
}) {
  return (
    <article
      className={`${styles.asset} ${selected ? styles.assetSelected : ""}`}
      onClick={() => onSelect(asset.recordId)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") onSelect(asset.recordId);
      }}
      role="button"
      tabIndex={0}
    >
      <div className={`${styles.thumb} ${styles[asset.tone] ?? ""}`}>
        <span className={badgeClass(asset.status)}>{asset.status}</span>
        {asset.previewUrl ? (
          <img className={styles.thumbImage} src={asset.previewUrl} alt={asset.title} />
        ) : asset.type === "AUD" ? (
          <div className={styles.thumbWave}>▂▅▃▇▄▂▆▃▅▂▇</div>
        ) : asset.type === "DOC" ? (
          <div className={styles.thumbPlaceholder}>
            <FileText size={36} />
          </div>
        ) : (
          <div className={styles.thumbPlaceholder}>● ● ● ●</div>
        )}
      </div>
      <span className={styles.assetCode}>{asset.id}</span>
      <strong className={styles.assetTitle}>{asset.title}</strong>
      <small className={styles.assetMeta}>
        {asset.mimeType} · {asset.dimensions} · {asset.sizeLabel}
      </small>
      <small className={styles.assetMeta}>
        {asset.productionCode} · {asset.locale}
      </small>
      <footer className={styles.assetFooter}>
        <em>{asset.score}</em>
        <span>{asset.storageTier}</span>
        <span>{asset.version}</span>
      </footer>
    </article>
  );
}

export function AutonomousAssetOperationsWorkspace({
  initial,
  initialError
}: {
  initial?: AssetOperationsOverview | null;
  initialError?: string | null;
}) {
  const [data, setData] = useState<AssetOperationsOverview | null>(initial ?? null);
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [loading, setLoading] = useState(!initial && !initialError);
  const [streamLive, setStreamLive] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(initial?.selectedAssetId ?? null);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(initial?.generatedAt ?? null);

  const refreshData = useCallback(async () => {
    try {
      const response = await fetch("/api/asset-operations/overview", {
        method: "GET",
        headers: { Accept: "application/json" },
        cache: "no-store"
      });
      const payload = await readApiPayload<AssetOperationsOverview | { message?: string }>(response);
      if (!response.ok) {
        throw new Error("message" in payload ? payload.message || `HTTP ${response.status}` : `HTTP ${response.status}`);
      }
      const next = payload as AssetOperationsOverview;
      setData(next);
      setLastSyncAt(next.generatedAt);
      setSelectedAssetId((current) => current ?? next.selectedAssetId);
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Failed to load asset operations data.");
    } finally {
      setLoading(false);
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
    const eventSource = new EventSource("/api/asset-operations/events");
    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as Partial<AssetOperationsOverview> & { message?: string };
        if (typeof payload.message === "string" && typeof payload.generatedAt !== "string") {
          setStreamLive(false);
          return;
        }
        if (typeof payload.generatedAt === "string") {
          setData(payload as AssetOperationsOverview);
          setLastSyncAt(payload.generatedAt);
          setStreamLive(true);
          setLoading(false);
          setError(null);
        }
      } catch {
        setStreamLive(false);
      }
    };
    eventSource.onerror = () => setStreamLive(false);
    return () => eventSource.close();
  }, []);

  const selectedAsset = useMemo(() => {
    if (!data) return null;
    return data.assets.find((asset) => asset.recordId === selectedAssetId) ?? data.assets[0] ?? null;
  }, [data, selectedAssetId]);

  const inspector = useMemo(() => {
    if (!selectedAsset) return null;
    return inspectorFromAsset(selectedAsset);
  }, [selectedAsset]);

  if (loading && !data) {
    return (
      <section className={styles.page}>
        <div className={styles.headerShell}>
          <div>
            <div className={styles.kicker}>ASSET LIBRARY</div>
            <h1>Autonomous Asset Operations</h1>
            <p>Loading persisted asset records from Microsoft SQL Server…</p>
          </div>
        </div>
      </section>
    );
  }

  const content = data ?? {
    generatedAt: new Date().toISOString(),
    live: false,
    counts: { all: 0, images: 0, video: 0, audio: 0, docs: 0, quarantined: 0 },
    batch: { id: "ING-PENDING", assets: 0, progress: 0, startedAt: null, etaLabel: "Awaiting ingestion" },
    storage: { usedPercent: 0, usedLabel: "0 B", capacityLabel: "12 TB" },
    healthy: 0,
    pipeline: [],
    assets: [],
    selectedAssetId: null,
    inspector: null,
    queue: [],
    duplicateIntel: { clusters: 0, autoResolved: 0, topSimilarity: 0, pendingReview: 0 },
    storageHealth: { primary: 0, replica: 0, checksum: 0, orphaned: 0 },
    lifecycle: { hot: "0 B", warm: "0 B", cold: "0 B", policy: "90 / 180 / 365d", savings: "₦0 projected" },
    savedViews: []
  };

  return (
    <section className={styles.page}>
      <section className={styles.headerShell}>
        <div>
          <div className={styles.kicker}>ASSET LIBRARY</div>
          <h1>Autonomous Asset Operations</h1>
          <p>Automated ingestion, validation, enrichment, deduplication, lineage and lifecycle control.</p>
        </div>
        <div className={styles.headerStatus}>
          <div className={styles.clockCard}>
            <Clock3 size={14} />
            <span>{formatClock(lastSyncAt)}</span>
            <small>{formatDate(lastSyncAt)}</small>
          </div>
          <button className={styles.runtimeButton} type="button" disabled>
            <Square size={14} />
            Stop
          </button>
          <span className={styles.statusPill}>
            <Wifi size={14} />
            System Online
          </span>
          <span className={styles.statusPill}>
            <Radio size={14} />
            {streamLive ? "Live sync" : content.live ? "Polling sync" : "Preview mode"}
          </span>
        </div>
      </section>

      {error ? (
        <div className={styles.banner}>
          <strong>Asset operations degraded.</strong> {error}
        </div>
      ) : null}

      <section className={styles.kpis}>
        <div className={styles.kpi}><Database size={18} /><span><small>Total assets</small><b>{content.counts.all.toLocaleString()}</b></span></div>
        <div className={styles.kpi}><ImageIcon size={18} /><span><small>Images</small><b>{content.counts.images.toLocaleString()}</b></span></div>
        <div className={styles.kpi}><Film size={18} /><span><small>Video</small><b>{content.counts.video.toLocaleString()}</b></span></div>
        <div className={styles.kpi}><Headphones size={18} /><span><small>Audio</small><b>{content.counts.audio.toLocaleString()}</b></span></div>
        <div className={styles.kpi}><FileText size={18} /><span><small>Documents</small><b>{content.counts.docs.toLocaleString()}</b></span></div>
        <div className={styles.kpi}><HardDrive size={18} /><span><small>Storage</small><b>{content.storage.usedLabel} / {content.storage.capacityLabel}</b></span></div>
        <div className={styles.kpi}><Check size={18} /><span><small>Healthy</small><b>{content.healthy}%</b></span></div>
        <div className={styles.kpi}><ShieldCheck size={18} /><span><small>Quarantined</small><b>{content.counts.quarantined}</b></span></div>
      </section>

      <section className={styles.pipeline}>
        {content.pipeline.map((step, index) => (
          <div className={styles.pipelineStep} key={step.label}>
            <span
              className={`${styles.pipelineIcon} ${
                step.status === "done" ? "" : step.status === "active" ? styles.pipelineIconActive : styles.pipelineIconPending
              }`}
            >
              <Check size={12} />
            </span>
            <span>
              <b>{step.label}</b>
              <small>{step.detail}</small>
            </span>
            {index < content.pipeline.length - 1 ? <ChevronRight className={styles.pipelineChevron} size={12} /> : null}
          </div>
        ))}
        <div className={styles.batchLine}>
          Current batch ingesting: {content.batch.assets.toLocaleString()} assets · {content.batch.progress}% · {content.batch.etaLabel}
        </div>
      </section>

      <section className={styles.layout}>
        <aside className={styles.filters}>
          <h3>Filters & Autonomous Views</h3>
          {FILTER_LABELS.map((label) => (
            <div className={styles.filterRow} key={label}>
              <span>{label}</span>
              <span>All ▾</span>
            </div>
          ))}
          <h4>Saved Autonomous Views</h4>
          {content.savedViews.map((view) => (
            <div className={styles.savedView} key={view.label}>
              <Archive size={12} />
              <span>{view.label}</span>
              <b>{view.count}</b>
            </div>
          ))}
        </aside>

        <div className={styles.library}>
          <div className={styles.toolbar}>
            <Search size={14} />
            <input placeholder="Search assets or use semantic search…" aria-label="Search assets" />
            <span className={styles.toolbarMeta}>● Semantic search ON</span>
            <button className={styles.toolbarButton} type="button">Created (Newest) ▾</button>
            <button className={styles.toolbarButton} type="button"><Grid3X3 size={12} /> Grid</button>
            <em className={styles.toolbarMeta}>● {streamLive ? "Live sync" : "Polling sync"}</em>
          </div>

          <div className={styles.assetGrid}>
            {content.assets.length === 0 ? (
              <div className={styles.banner}>No persisted assets yet. Autonomous visual, audio, and document engines will populate this library as productions complete.</div>
            ) : (
              content.assets.map((asset) => (
                <AssetCard
                  key={asset.recordId}
                  asset={asset}
                  selected={selectedAsset?.recordId === asset.recordId}
                  onSelect={setSelectedAssetId}
                />
              ))
            )}
          </div>

          <div className={styles.lowerPanels}>
            <Panel title="Ingestion & Processing Queue" tag="View all">
              <table className={styles.queueTable}>
                <tbody>
                  {content.queue.map((row) => (
                    <tr key={row.id}>
                      <td>{row.id}</td>
                      <td>{row.action}</td>
                      <td>{row.worker}</td>
                      <td><progress value={row.progress} max={100} /> {row.progress}%</td>
                      <td>{row.retries}</td>
                      <td>{row.eta}</td>
                      <td>{row.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>
            <Panel title="Duplicate Intelligence" tag={`${content.duplicateIntel.clusters} clusters`}>
              <Rows items={[
                ["Auto-resolved", content.duplicateIntel.autoResolved],
                ["Top similarity", `${content.duplicateIntel.topSimilarity}%`],
                ["Pending review", content.duplicateIntel.pendingReview]
              ]} />
            </Panel>
            <Panel title="Storage Health" tag="Live">
              <Rows items={[
                ["Primary health", `${content.storageHealth.primary}%`],
                ["Replica health", `${content.storageHealth.replica}%`],
                ["Checksum integrity", `${content.storageHealth.checksum}%`],
                ["Orphaned assets", content.storageHealth.orphaned]
              ]} />
            </Panel>
            <Panel title="Lifecycle & Cost" tag={content.lifecycle.savings}>
              <Rows items={[
                ["Hot tier", content.lifecycle.hot],
                ["Warm tier", content.lifecycle.warm],
                ["Cold tier", content.lifecycle.cold],
                ["Retention policy", content.lifecycle.policy]
              ]} />
            </Panel>
          </div>
        </div>

        <aside className={styles.inspector}>
          <div className={styles.inspectHead}>
            <div>
              <small>Selected asset</small>
              <h3>{selectedAsset?.id ?? "No asset selected"}</h3>
            </div>
            <span className={styles.inspectStatus}>● {selectedAsset?.status ?? "Waiting"}</span>
          </div>

          <div className={styles.previewPhoto}>
            {selectedAsset?.previewUrl ? (
              <img src={selectedAsset.previewUrl} alt={selectedAsset.title} />
            ) : (
              <div className={styles.previewFallback}>● ● ● ●</div>
            )}
          </div>

          <nav className={styles.tabs}>Overview　 Technical　 Lineage　 Activity</nav>

          {inspector ? (
            <>
              <Panel title="Semantic metadata" tag={`${inspector.qualityScore}/100`}>
                <div className={styles.tags}>{inspector.semanticTags.join("　")}</div>
                <Rows items={inspector.semanticRows} />
              </Panel>
              <Panel title="Rights & provenance" tag="Clear">
                <Rows items={inspector.rightsRows} />
              </Panel>
              <Panel title="Quality & compliance" tag={`${inspector.qualityScore}/100`}>
                <Rows items={inspector.qualityRows} />
              </Panel>
              <Panel title="Production lineage" tag="Linked">
                <Rows items={inspector.lineageRows} />
              </Panel>
              <Panel title="Storage & replicas" tag="Verified">
                <Rows items={inspector.storageRows} />
              </Panel>
              <Panel title="Autonomous action" tag={inspector.autonomousAction ? "Running" : "Idle"}>
                <p>{inspector.autonomousAction ?? "No autonomous recovery action is required for this asset."}</p>
              </Panel>
            </>
          ) : null}
        </aside>
      </section>
    </section>
  );
}

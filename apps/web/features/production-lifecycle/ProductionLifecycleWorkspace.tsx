"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, ArrowRight, BarChart3, Brain, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight,
  CircleDot, ClipboardCheck, FileOutput, FileText, Gauge, Infinity, Layers3, Link2, Monitor, PlaySquare,
  Rocket, Search, Settings2, ShieldCheck, Sparkles, Target, UsersRound
} from "lucide-react";
import {
  lifecycleStageValidationRules,
  lifecyclePhases,
  productionLifecycleStages,
  type ProductionLifecycleStage
} from "@cacsms/contracts";
import type { LifecycleQueueItem, LifecycleStatusPayload } from "@/lib/production-lifecycle-data";
import styles from "./ProductionLifecycleWorkspace.module.css";

const icons = {
  discover: Target, research: Search, evaluate: ClipboardCheck, "pre-plan": FileText, schedule: CalendarDays,
  produce: PlaySquare, assemble: Layers3, quality: ShieldCheck, export: FileOutput, publish: Rocket,
  monitor: BarChart3, learn: Brain, repeat: Infinity
} as const;
const phaseNames = { intelligence: "Intelligence", planning: "Planning", creation: "Creation", release: "Release", improvement: "Improvement" };
const CHECKLIST = ["Required work completed", "Validation checks passed", "Exceptions and blockers resolved", "Stage output recorded", "Next stage is ready"];

type Props = {
  stage: ProductionLifecycleStage;
  initialStatus: LifecycleStatusPayload | null;
};

export function ProductionLifecycleWorkspace({ stage, initialStatus }: Props) {
  const [status, setStatus] = useState<LifecycleStatusPayload | null>(initialStatus);
  const [queue, setQueue] = useState<LifecycleQueueItem[]>([]);
  const [queueStage, setQueueStage] = useState(stage.id);
  const [role, setRole] = useState<"all" | "primary" | "supporting">("all");
  const [checks, setChecks] = useState<boolean[]>(CHECKLIST.map((_, i) => i < 2));
  const [markReadyState, setMarkReadyState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [markReadyError, setMarkReadyError] = useState<string | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [scrollHints, setScrollHints] = useState({ left: false, right: false });

  const autoAdvance = status?.settings.autoAdvanceEnabled ?? true;
  const stageStatuses = useMemo(() => {
    const map = new Map(status?.stages.map((item) => [item.id, item]) ?? []);
    return productionLifecycleStages.map((item) => map.get(item.id) ?? { id: item.id, count: 0, statusLabel: item.statusLabel, trend: "stable" as const });
  }, [status]);

  const refreshStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/production-lifecycle/status", { cache: "no-store" });
      if (response.ok) setStatus(await response.json());
    } catch {
      /* keep last good payload */
    }
  }, []);

  const refreshQueue = useCallback(async (stageId: string) => {
    try {
      const response = await fetch(`/api/production-lifecycle/queue/${stageId}`, { cache: "no-store" });
      if (response.ok) {
        const payload = await response.json();
        setQueue(payload.items ?? []);
      }
    } catch {
      setQueue([]);
    }
  }, []);

  useEffect(() => {
    void refreshStatus();
    const timer = window.setInterval(() => void refreshStatus(), 30_000);
    return () => window.clearInterval(timer);
  }, [refreshStatus]);

  useEffect(() => {
    setQueueStage(stage.id);
  }, [stage.id]);

  useEffect(() => {
    void refreshQueue(queueStage);
    const timer = window.setInterval(() => void refreshQueue(queueStage), 30_000);
    return () => window.clearInterval(timer);
  }, [queueStage, refreshQueue]);

  useEffect(() => {
    const node = scrollerRef.current;
    if (!node) return;
    const update = () => setScrollHints({ left: node.scrollLeft > 8, right: node.scrollLeft + node.clientWidth < node.scrollWidth - 8 });
    update();
    node.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    return () => {
      node.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [stage.id]);

  const currentIndex = productionLifecycleStages.findIndex((item) => item.id === stage.id);
  const previous = productionLifecycleStages[currentIndex - 1];
  const next = productionLifecycleStages[currentIndex + 1];
  const grouped = useMemo(() => {
    const pages = role === "all" ? stage.pages : stage.pages.filter((item) => item.role === role);
    return pages.reduce<Record<string, typeof pages>>((groups, item) => {
      (groups[item.module] ??= []).push(item);
      return groups;
    }, {});
  }, [role, stage.pages]);

  async function toggleAutoAdvance() {
    const nextValue = !autoAdvance;
    setStatus((current) => current ? { ...current, settings: { ...current.settings, autoAdvanceEnabled: nextValue } } : current);
    await fetch("/api/production-lifecycle/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ autoAdvanceEnabled: nextValue })
    });
    void refreshStatus();
  }

  async function markStageReady() {
    setMarkReadyState("loading");
    setMarkReadyError(null);
    const selectedChecks = CHECKLIST.filter((_, index) => checks[index]);
    const validationChecks = lifecycleStageValidationRules[stage.id].requiredChecks;
    try {
      const response = await fetch(`/api/production-lifecycle/${stage.id}/mark-ready`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checks: [...validationChecks, ...selectedChecks] })
      });
      const payload = await response.json();
      if (!response.ok) {
        setMarkReadyState("error");
        setMarkReadyError(payload.validationErrors?.join(" · ") ?? payload.message ?? "Unable to mark stage ready.");
        return;
      }
      setMarkReadyState("done");
      void refreshStatus();
      void refreshQueue(stage.id);
    } catch {
      setMarkReadyState("error");
      setMarkReadyError("Network error while marking stage ready.");
    }
  }

  function scrollRail(direction: "left" | "right") {
    scrollerRef.current?.scrollBy({ left: direction === "left" ? -420 : 420, behavior: "smooth" });
  }

  return (
    <section className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <span>Production Workflow <i>/</i> Stage {stage.order} of 13</span>
          <h1>{stage.label}</h1>
          <p>{stage.description}</p>
        </div>
        <div className={styles.headerActions}>
          <Link href="/production-pipeline/index.html"><Gauge size={16} />Pipeline Overview</Link>
          <Link className={styles.primary} href={stage.pages[0]?.href ?? "/dashboard"}><ArrowRight size={16} />Open Primary Workspace</Link>
        </div>
      </header>

      <section className={styles.lifecycle} aria-label="Production life cycle">
        <header>
          <div><h2>Production Life Cycle</h2><p>Navigate the end-to-end autonomous production workflow.</p></div>
          <label>Auto-Advance
            <button type="button" role="switch" aria-checked={autoAdvance} className={autoAdvance ? styles.switchOn : styles.switch} onClick={() => void toggleAutoAdvance()}><span /></button>
          </label>
          <Link href="/settings/production-defaults"><Settings2 size={14} />Configure</Link>
        </header>
        <div className={styles.phaseBand}>
          {lifecyclePhases.map((phase) => <span key={phase.id} data-active={phase.id === stage.phase}>{phase.label}<small>{phase.description}</small></span>)}
        </div>
        <div className={styles.stageScrollerWrap}>
          {scrollHints.left ? <button type="button" className={styles.scrollBtn} onClick={() => scrollRail("left")} aria-label="Scroll stages left"><ChevronLeft size={18} /></button> : null}
          <div className={styles.stageScroller} ref={scrollerRef}>
            <div className={styles.stageRail}>
              {productionLifecycleStages.map((item, index) => {
                const Icon = icons[item.id];
                const live = stageStatuses.find((s) => s.id === item.id);
                const complete = item.order < stage.order;
                return (
                  <div className={styles.stageWrap} key={item.id}>
                    <Link
                      href={`/production-workflow/${item.id}`}
                      className={`${styles.stage}${item.id === stage.id ? ` ${styles.active}` : ""}${complete ? ` ${styles.complete}` : ""}${queueStage === item.id && item.id !== stage.id ? ` ${styles.queueFocus}` : ""}`}
                      aria-current={item.id === stage.id ? "step" : undefined}
                      onMouseEnter={() => setQueueStage(item.id)}
                      onFocus={() => setQueueStage(item.id)}
                    >
                      <b>{item.order}</b><i><Icon size={21} /></i><strong>{item.label}</strong><small>{item.description}</small><em>{live?.statusLabel ?? item.statusLabel}</em>
                    </Link>
                    {index < productionLifecycleStages.length - 1 ? <ChevronRight className={styles.arrow} size={18} /> : null}
                  </div>
                );
              })}
            </div>
          </div>
          {scrollHints.right ? <button type="button" className={`${styles.scrollBtn} ${styles.scrollBtnRight}`} onClick={() => scrollRail("right")} aria-label="Scroll stages right"><ChevronRight size={18} /></button> : null}
        </div>
        <p className={styles.scrollHint}>All 13 stages · hover or focus a stage to preview its live queue</p>
      </section>

      <section className={styles.stageSummary}>
        <article><i><CircleDot size={22} /></i><span><small>Current phase</small><b>{phaseNames[stage.phase]}</b><em>Stage {stage.order} of 13</em></span></article>
        <article><i><CheckCircle2 size={22} /></i><span><small>Required outcome</small><b>{stage.outcome}</b><em>Complete this outcome before advancing.</em></span></article>
        <article><i><UsersRound size={22} /></i><span><small>Connected workspaces</small><b>{stage.pages.length} canonical pages</b><em>{new Set(stage.pages.map((item) => item.module)).size} capability modules</em></span></article>
        <article><i><Sparkles size={22} /></i><span><small>Automation policy</small><b>{autoAdvance ? "Auto-advance enabled" : "Manual advancement"}</b><em>{autoAdvance ? "Advance when required checks pass." : "A user must approve stage completion."}</em></span></article>
      </section>

      <section className={styles.crossStage}>
        <header><h2>Production-centric view</h2><p>Opportunity lifecycle stage linked to production orchestrator stage.</p></header>
        {(status?.productionCentric?.length ?? 0) === 0 ? (
          <p className={styles.crossStageEmpty}>No linked opportunity/production records yet.</p>
        ) : (
          <div className={styles.crossStageList}>
            {status?.productionCentric.slice(0, 8).map((item) => (
              <article key={`${item.opportunityId ?? "none"}-${item.productionId ?? "none"}`}>
                <div><strong>{item.opportunityTitle ?? "Unlinked opportunity"}</strong><small>{item.opportunityLifecycleStage ?? "—"}</small></div>
                <span><Link2 size={14} />{item.linked ? "Linked" : "Partial"}</span>
                <div><strong>{item.productionTitle ?? "No production yet"}</strong><small>{item.productionLifecycleStage ?? item.productionOrchestratorStage ?? "—"}</small></div>
              </article>
            ))}
          </div>
        )}
      </section>

      <div className={styles.contentGrid}>
        <main>
          <section className={styles.queuePanel}>
            <header><div><h2>Live queue · {productionLifecycleStages.find((s) => s.id === queueStage)?.label ?? stage.label}</h2><p>{queue.length} item(s) from MSSQL</p></div></header>
            {queue.length === 0 ? <p className={styles.queueEmpty}>No active items in this stage.</p> : (
              <div className={styles.queueList}>
                {queue.map((item) => (
                  <div key={item.id} className={styles.queueItem}>
                    <span><b>{item.title}</b><small>{item.entityType} · {item.status} · {item.progress}%</small></span>
                    {item.href ? <Link href={item.href}>Open</Link> : <em>{item.updatedAt}</em>}
                  </div>
                ))}
              </div>
            )}
          </section>

          <header className={styles.directoryHeader}>
            <div><h2>{stage.label} workspace directory</h2><p>Open the existing canonical page needed for this stage. No pages are duplicated.</p></div>
            <div>
              <button className={role === "all" ? styles.selected : ""} onClick={() => setRole("all")}>All</button>
              <button className={role === "primary" ? styles.selected : ""} onClick={() => setRole("primary")}>Primary</button>
              <button className={role === "supporting" ? styles.selected : ""} onClick={() => setRole("supporting")}>Supporting</button>
            </div>
          </header>
          <div className={styles.moduleGroups}>
            {Object.entries(grouped).map(([module, pages]) => (
              <section key={module}>
                <header><h3>{module}</h3><span>{pages.length} page{pages.length === 1 ? "" : "s"}</span></header>
                <div>
                  {pages.map((link) => (
                    <Link href={link.href} key={`${module}-${link.label}`}>
                      <i>{link.role === "primary" ? <CircleDot size={16} /> : <Monitor size={16} />}</i>
                      <span><b>{link.label}</b><small>{link.purpose}</small></span>
                      <em>{link.role}</em><ArrowRight size={15} />
                    </Link>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </main>

        <aside>
          <section className={styles.checklist}>
            <h2>Stage completion standard</h2>
            <p>Advance only when the required outcome is complete and supporting evidence is recorded.</p>
            {CHECKLIST.map((item, index) => (
              <label key={item}><input type="checkbox" checked={checks[index]} onChange={() => setChecks((current) => current.map((value, i) => i === index ? !value : value))} /><span>{item}</span></label>
            ))}
            {markReadyError ? <p className={styles.errorText}>{markReadyError}</p> : null}
            <button type="button" onClick={() => void markStageReady()} disabled={markReadyState === "loading"}>
              <CheckCircle2 size={15} />{markReadyState === "done" ? "Stage marked ready" : markReadyState === "loading" ? "Validating…" : "Mark stage ready"}
            </button>
          </section>
          <section className={styles.governance}>
            <h2>Lifecycle governance</h2>
            <dl>
              <div><dt>Stage owner</dt><dd>{stage.pages[0]?.module}</dd></div>
              <div><dt>Canonical route</dt><dd>/production-workflow/{stage.id}</dd></div>
              <div><dt>Auto-advance</dt><dd>{autoAdvance ? "Enabled" : "Disabled"}</dd></div>
              <div><dt>Page ownership</dt><dd>Capability modules</dd></div>
            </dl>
          </section>
        </aside>
      </div>

      <footer className={styles.stageNavigation}>
        {previous ? <Link href={`/production-workflow/${previous.id}`}><ArrowLeft size={16} /><span><small>Previous stage</small><b>{previous.label}</b></span></Link> : <span />}
        <Link href="/production-workflow/discover" className={styles.allStages}>View complete lifecycle</Link>
        {next ? <Link href={`/production-workflow/${next.id}`}><span><small>Next stage</small><b>{next.label}</b></span><ArrowRight size={16} /></Link> : <span />}
      </footer>
    </section>
  );
}

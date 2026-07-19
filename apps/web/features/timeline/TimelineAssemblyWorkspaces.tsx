import Link from "next/link";
import type { ReactNode } from "react";
import { CheckCircle2, Clapperboard, Layers3, Radio } from "lucide-react";
import { getTimelineAssemblyData } from "@/lib/timeline-assembly-data";
import styles from "@/features/collaboration/autonomous-assignments.module.css";

export async function MasterTimelineWorkspace() {
  const data = await getTimelineAssemblyData();
  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <div>
          <div className={styles.eyebrow}><span />Timeline Studio / Master Timeline</div>
          <h1>Master Timeline</h1>
          <p>Assemble synchronized master edits from production assets and rendering jobs.</p>
        </div>
        <div className={styles.heroActions}>
          <span className={`${styles.liveBadge} ${styles.online}`}><i />{data.summary.inAssembly} in assembly</span>
        </div>
      </header>
      <section className={styles.metrics}>
        <Metric icon={<Layers3 />} label="In assembly" value={String(data.summary.inAssembly)} note="Active productions" />
        <Metric icon={<Clapperboard />} label="Rendering" value={String(data.summary.rendering)} note="Live render jobs" />
        <Metric icon={<CheckCircle2 />} label="Ready" value={String(data.summary.ready)} note="Near completion" />
      </section>
      <section className={styles.grid}>
        <article className={styles.panel}>
          <div className={styles.panelHeader}><div><h2>Assembly queue</h2><p>Productions linked to rendering jobs and agent runs.</p></div></div>
          {data.productions.length === 0 ? (
            <div className={styles.empty}><Layers3 className={styles.icon} /><h3>No assembly work yet</h3><p>Productions advance here when asset engines complete.</p></div>
          ) : (
            <div className={styles.workloads}>
              {data.productions.map((production) => (
                <div className={styles.workload} key={production.id}>
                  <div className={styles.workloadTop}><strong>{production.title}</strong><b>{production.stage}</b></div>
                  <p>{production.code} · {production.progress}% · {production.renderingJobs.length} render job(s)</p>
                  <span className={styles.loadBar}><i style={{ width: `${production.progress}%` }} /></span>
                </div>
              ))}
            </div>
          )}
        </article>
      </section>
    </main>
  );
}

export async function AutoAssembleWorkspace() {
  const data = await getTimelineAssemblyData();
  const candidates = data.productions.filter((p) => p.stage !== "assembly" && p.progress >= 60);
  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <div>
          <div className={styles.eyebrow}><span />Timeline Studio / Auto Assemble</div>
          <h1>Auto Assemble</h1>
          <p>Build initial automated edits when asset readiness thresholds pass.</p>
        </div>
      </header>
      <section className={styles.grid}>
        <article className={styles.panel}>
          <div className={styles.panelHeader}><div><h2>Auto-assemble candidates</h2><p>Productions with sufficient asset progress.</p></div><span className={styles.health}><Radio size={14} />Live</span></div>
          {candidates.length === 0 ? (
            <div className={styles.empty}><Clapperboard className={styles.icon} /><h3>No candidates</h3><p>Asset engines must reach 60% progress before auto-assembly.</p></div>
          ) : (
            <div className={styles.workloads}>
              {candidates.map((production) => (
                <div className={styles.workload} key={production.id}>
                  <div className={styles.workloadTop}><strong>{production.title}</strong><b>{production.progress}%</b></div>
                  <p>{production.agentRuns.filter((a) => a.status === "completed").length} agents complete</p>
                  <Link href="/timeline/master-timeline" className={styles.textButton}>Open master timeline</Link>
                </div>
              ))}
            </div>
          )}
        </article>
      </section>
    </main>
  );
}

function Metric({ icon, label, value, note }: { icon: ReactNode; label: string; value: string; note: string }) {
  return (
    <article className={styles.metric}>
      <span className={`${styles.metricIcon} ${styles.blue}`}>{icon}</span>
      <div><p>{label}</p><strong>{value}</strong><small>{note}</small></div>
    </article>
  );
}

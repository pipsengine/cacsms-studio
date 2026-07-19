import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, ShieldCheck } from "lucide-react";
import { getQualityComplianceData } from "@/lib/quality-compliance-data";
import styles from "@/features/collaboration/autonomous-assignments.module.css";

export async function QualityDashboardWorkspace() {
  const data = await getQualityComplianceData();
  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <div>
          <div className={styles.eyebrow}><span />Quality & Compliance / Quality Dashboard</div>
          <h1>Quality Dashboard</h1>
          <p>Orchestrator QA decisions, rendering status, and production blockers.</p>
        </div>
      </header>
      <section className={styles.metrics}>
        <Metric icon={<ShieldCheck />} label="In review" value={String(data.summary.inReview)} note="QA stage" />
        <Metric icon={<CheckCircle2 />} label="Passed gates" value={String(data.summary.passed)} note="Readiness ≥ 78" />
        <Metric icon={<AlertTriangle />} label="Blocked" value={String(data.summary.blocked)} note="Open blockers" />
      </section>
      <section className={styles.grid}>
        <article className={styles.panel}>
          <div className={styles.panelHeader}><div><h2>Quality review queue</h2><p>Live orchestrator telemetry.</p></div></div>
          {data.productions.length === 0 ? (
            <div className={styles.empty}><ShieldCheck className={styles.icon} /><h3>No QA items</h3><p>Productions appear here at quality-assurance stage.</p></div>
          ) : (
            <div className={styles.workloads}>
              {data.productions.map((production) => (
                <div className={styles.workload} key={production.id}>
                  <div className={styles.workloadTop}><strong>{production.title}</strong><b>{production.stage}</b></div>
                  <p>Readiness {production.readiness}% · Risk {production.risk}% · Confidence {production.confidence}%</p>
                  {production.blockers.length > 0 ? <p>Blockers: {production.blockers.join(", ")}</p> : null}
                  {production.renderingStatus ? <p>Render: {production.renderingStatus}</p> : null}
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

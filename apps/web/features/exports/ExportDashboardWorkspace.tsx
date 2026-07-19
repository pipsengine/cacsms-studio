import type { ReactNode } from "react";
import { FileOutput, Gauge } from "lucide-react";
import { getExportCenterData } from "@/lib/export-center-data";
import styles from "@/features/collaboration/autonomous-assignments.module.css";

export async function ExportDashboardWorkspace() {
  const data = await getExportCenterData();
  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <div>
          <div className={styles.eyebrow}><span />Export Center / Export Dashboard</div>
          <h1>Export Dashboard</h1>
          <p>Monitor rendering jobs and deliverable packaging from MSSQL.</p>
        </div>
      </header>
      <section className={styles.metrics}>
        <Metric icon={<Gauge />} label="Exporting" value={String(data.summary.exporting)} note="Active jobs" />
        <Metric icon={<FileOutput />} label="Completed" value={String(data.summary.completed)} note="Deliverables" />
        <Metric icon={<FileOutput />} label="Failed" value={String(data.summary.failed)} note="Needs retry" />
      </section>
      <section className={styles.grid}>
        <article className={styles.panel}>
          <div className={styles.panelHeader}><div><h2>Render and export jobs</h2></div></div>
          {data.jobs.length === 0 ? (
            <div className={styles.empty}><FileOutput className={styles.icon} /><h3>No export jobs</h3></div>
          ) : (
            <div className={styles.workloads}>
              {data.jobs.map((job) => (
                <div className={styles.workload} key={job.id}>
                  <div className={styles.workloadTop}><strong>{job.productionTitle}</strong><b>{job.status}</b></div>
                  <p>{job.assetName} · {job.engine} · {job.progress}% · attempt {job.attemptCount}</p>
                  <span className={styles.loadBar}><i style={{ width: `${job.progress}%` }} /></span>
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

import type { ReactNode } from "react";
import { Globe2, Rocket } from "lucide-react";
import { getPublishingCenterData } from "@/lib/publishing-center-data";
import styles from "@/features/collaboration/autonomous-assignments.module.css";

export async function PublishingDashboardWorkspace() {
  const data = await getPublishingCenterData();
  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <div>
          <div className={styles.eyebrow}><span />Publishing Center / Publishing Dashboard</div>
          <h1>Publishing Dashboard</h1>
          <p>Channel releases from PublishingJobs with live status.</p>
        </div>
      </header>
      <section className={styles.metrics}>
        <Metric icon={<Rocket />} label="Publishing" value={String(data.summary.publishing)} note="In flight" />
        <Metric icon={<Globe2 />} label="Published" value={String(data.summary.published)} note="Completed" />
        <Metric icon={<Globe2 />} label="Scheduled" value={String(data.summary.scheduled)} note="Queued" />
      </section>
      <section className={styles.grid}>
        <article className={styles.panel}>
          <div className={styles.panelHeader}><div><h2>Publishing queue</h2></div></div>
          {data.jobs.length === 0 ? (
            <div className={styles.empty}><Rocket className={styles.icon} /><h3>No publishing jobs</h3></div>
          ) : (
            <div className={styles.workloads}>
              {data.jobs.map((job) => (
                <div className={styles.workload} key={job.id}>
                  <div className={styles.workloadTop}><strong>{job.productionTitle}</strong><b>{job.status}</b></div>
                  <p>{job.channel} · {job.accountName}{job.scheduledAt ? ` · ${job.scheduledAt}` : ""}</p>
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

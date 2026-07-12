import Link from "next/link";
import { ArrowRight, Bot, Clapperboard, DatabaseZap, FileCheck2, Layers3, RadioTower, Telescope, Wand2 } from "lucide-react";
import {
  contentTypeDefinitions,
  knowledgeUniverseMetrics,
  navigationModules,
  opportunityPortfolio,
  productionPipeline
} from "@cacsms/contracts";

const metrics = [
  { label: "Production Types", value: contentTypeDefinitions.length, detail: "Configuration-driven definitions" },
  { label: "Studio Modules", value: navigationModules.length, detail: "Executive and operational workspaces" },
  { label: "Pipeline Stages", value: productionPipeline.length, detail: "Idea to publishing workflow" },
  { label: "Live Opportunities", value: opportunityPortfolio.length, detail: "Autonomous executive producer queue" },
  { label: "Knowledge Objects", value: knowledgeUniverseMetrics[0]?.value ?? "0", detail: "World model intelligence layer" }
];

export function Dashboard() {
  return (
    <>
      <section className="page-header">
        <span className="eyebrow">Executive Dashboard</span>
        <h2>Autonomous media production from first idea to publishable package.</h2>
        <p>
          CACSMS Studio converts topics, documents, lessons, stories, and instructions into structured scripts,
          planned scenes, generated media, synchronized timelines, checked outputs, and export-ready packages.
        </p>
      </section>

      <section className="grid cols-4">
        {metrics.map((metric) => (
          <article className="card" key={metric.label}>
            <div className="metric">{metric.value}</div>
            <h3>{metric.label}</h3>
            <p>{metric.detail}</p>
          </article>
        ))}
      </section>

      <section className="grid cols-2" style={{ marginTop: 16 }}>
        <article className="card">
          <h3>Production Pipeline</h3>
          <div className="stage-list">
            {productionPipeline.map((stage, index) => (
              <div className="stage" key={stage.id}>
                <span className="stage-number">{index + 1}</span>
                <span>
                  <h3>{stage.label}</h3>
                  <p>{stage.description}</p>
                </span>
                <span className="status">Ready</span>
              </div>
            ))}
          </div>
        </article>

        <article className="card">
          <h3>Operational Workspaces</h3>
          <p className="muted">
            Each sidebar area is a generated workspace backed by platform configuration, so the studio can expand
            without duplicating pages for every production format.
          </p>
          <div className="grid" style={{ marginTop: 14 }}>
            {[
              { href: "/productions/create", icon: Clapperboard, label: "Create Production" },
              { href: "/opportunity-intelligence", icon: Telescope, label: "Opportunity Intelligence" },
              { href: "/knowledge-universe", icon: DatabaseZap, label: "Knowledge Universe" },
              { href: "/intelligence", icon: Wand2, label: "Content Intelligence" },
              { href: "/agents", icon: Bot, label: "AI Agent Teams" },
              { href: "/timeline", icon: Layers3, label: "Timeline Assembly" },
              { href: "/quality", icon: FileCheck2, label: "Quality & Compliance" },
              { href: "/publishing", icon: RadioTower, label: "Publishing Center" }
            ].map((item) => {
              const Icon = item.icon;
              return (
                <Link className="button" href={item.href} key={item.href}>
                  <Icon size={16} aria-hidden="true" />
                  {item.label}
                  <ArrowRight size={16} aria-hidden="true" />
                </Link>
              );
            })}
          </div>
        </article>
      </section>
    </>
  );
}

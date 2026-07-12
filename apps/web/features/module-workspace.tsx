import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { contentTypeDefinitions, navigationModules, productionPipeline } from "@cacsms/contracts";

export function ModuleWorkspace({
  moduleSlug,
  workspaceSlug
}: {
  moduleSlug: string;
  workspaceSlug?: string;
}) {
  const module = navigationModules.find((item) => item.slug === moduleSlug);

  if (!module) {
    return (
      <section className="page-header">
        <span className="eyebrow">Workspace</span>
        <h2>Module not found.</h2>
        <p>The requested module is not registered in the studio configuration.</p>
      </section>
    );
  }

  const workspace = workspaceSlug ? module.children.find((child) => child.slug === workspaceSlug) : undefined;
  const title = workspace?.label ?? module.label;

  return (
    <>
      <section className="page-header">
        <span className="eyebrow">{module.label}</span>
        <h2>{title}</h2>
        <p>{workspace ? workspaceDescription(module.label, workspace.label) : module.description}</p>
      </section>

      <section className="grid cols-3">
        <article className="card">
          <h3>Workspace Actions</h3>
          <div className="grid">
            {module.children.slice(0, 9).map((child) => (
              <Link
                className="button"
                href={module.slug === "productions" && child.slug === "create-production" ? "/productions/create" : `/${module.slug}/${child.slug}`}
                key={child.slug}
              >
                {child.label}
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            ))}
          </div>
        </article>

        <article className="card">
          <h3>Configuration Coverage</h3>
          <div className="stage-list">
            {["Workflow stages", "Agent team routing", "Templates", "Quality rules", "Export settings"].map((item) => (
              <div className="stage" key={item}>
                <CheckCircle2 size={22} color="#08645f" aria-hidden="true" />
                <span>
                  <h3>{item}</h3>
                  <p>Resolved from platform and content-type definitions.</p>
                </span>
                <span className="status">Configured</span>
              </div>
            ))}
          </div>
        </article>

        <article className="card">
          <h3>Production Types</h3>
          <p className="muted">This module can participate in every configured production format.</p>
          <div className="pill-row" style={{ marginTop: 12 }}>
            {contentTypeDefinitions.map((type) => (
              <span className="pill" key={type.id}>
                {type.label}
              </span>
            ))}
          </div>
        </article>
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <h3>Pipeline Responsibilities</h3>
        <div className="grid cols-2">
          {productionPipeline.map((stage, index) => (
            <div className="stage" key={stage.id}>
              <span className="stage-number">{index + 1}</span>
              <span>
                <h3>{stage.label}</h3>
                <p>{stage.description}</p>
              </span>
              <span className="status">Available</span>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

function workspaceDescription(moduleLabel: string, workspaceLabel: string) {
  return `${workspaceLabel} is an operational workspace inside ${moduleLabel}. It inherits the production type workflow, agent team, templates, quality rules, and export settings selected in the production wizard.`;
}

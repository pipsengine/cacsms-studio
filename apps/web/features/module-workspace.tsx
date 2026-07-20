import Link from "next/link";
import {
  ArrowRight,
  BrainCircuit,
  CalendarClock,
  CheckCircle2,
  DatabaseZap,
  Gauge,
  Lightbulb,
  Network,
  Radar,
  Sparkles,
  Telescope
} from "lucide-react";
import {
  autonomyModes,
  contentTypeDefinitions,
  evergreenKnowledgeBank,
  executiveProducerAgents,
  knowledgeAgents,
  knowledgeCollections,
  knowledgeCoreEngines,
  knowledgeDatabaseObjects,
  knowledgeDomains,
  knowledgeGovernanceControls,
  knowledgeGraphNodes,
  knowledgeGraphRelationships,
  knowledgePredictions,
  knowledgeQualityDimensions,
  knowledgeRelationshipTypes,
  knowledgeUniverseMetrics,
  multiFormatPlan,
  navigationModules,
  opportunityCampaigns,
  opportunityCategories,
  opportunityPortfolio,
  opportunityScoreModel,
  opportunitySignalSources,
  opportunityStates,
  productionPipeline
} from "@cacsms/contracts";
import { ExecutiveDashboard } from "@/features/executive-dashboard/ExecutiveDashboard";
import { getExecutiveDashboardData } from "@/lib/executive-dashboard-data";
import { MyWorkspaceDashboard } from "@/features/my-workspace/MyWorkspaceDashboard";
import { getMyWorkspaceData } from "@/lib/my-workspace-data";
import { ActiveProductionsPage } from "@/features/active-productions/ActiveProductionsPage";
import { RecentProductionsPage } from "@/features/recent-productions/RecentProductionsPage";
import { ComingSoonPage } from "@/features/coming-soon/ComingSoonPage";
import { isWorkspaceRouteImplemented } from "@/lib/workspace-routes";
import { ProductionDefaultsPage } from "@/features/settings/ProductionDefaultsPage";
import { KnowledgeUniversePage } from "@/features/knowledge-universe/KnowledgeUniversePage";
import { PredictionEnginePage } from "@/features/knowledge-universe/PredictionEnginePage";
import { KnowledgeQualityPage } from "@/features/knowledge-universe/KnowledgeQualityPage";
import { listKnowledgeRecords, type KnowledgeRecordType } from "@/lib/knowledge-universe-data";
import { StructureDashboard } from "@/features/story-learning/StructureDashboard";
import { TemplateDashboard } from "@/features/templates/TemplateDashboard";
import { AutonomousAutomationWorkspace } from "@/features/automation/AutonomousAutomationWorkspace";
import { AutonomousScheduledProductionsPage } from "@/features/automation/AutonomousScheduledProductionsPage";
import { AutonomousPublishingSchedulerPage } from "@/features/publishing/AutonomousPublishingSchedulerPage";
import { AutonomousAssignmentsPage } from "@/features/collaboration/AutonomousAssignmentsPage";
import { ScriptEditorWorkspace } from "@/features/writing/ScriptEditorWorkspace";
import { getScriptEditorData } from "@/lib/script-editor-data";
import { ScriptIntelligenceWorkspace } from "@/features/writing/ScriptIntelligenceWorkspace";
import { getScriptIntelligenceWorkspaceData } from "@/lib/script-intelligence-engine";
import { AutonomousImageGeneratorWorkspace } from "@/features/visuals/AutonomousImageGeneratorWorkspace";
import { getImageGeneratorData } from "@/lib/image-generator-data";
import { VisualStudioInfrastructureWorkspace } from "@/features/visuals/VisualStudioInfrastructureWorkspace";
import { getVisualStudioInfrastructureData, type VisualInfraMode } from "@/lib/visual-studio-infra-engine";
import { AutonomousStoryboardWorkspace } from "@/features/storyboard/AutonomousStoryboardWorkspace";
import { getStoryboardWorkspaceData } from "@/lib/storyboard-engine";
import { AssetRequirementsWorkspace } from "@/features/storyboard/AssetRequirementsWorkspace";
import { getAssetRequirementsWorkspaceData } from "@/lib/storyboard-asset-requirements-engine";
import { AutonomousSceneVideoWorkspace } from "@/features/video/AutonomousSceneVideoWorkspace";
import { getSceneVideoWorkspaceData } from "@/lib/scene-video-engine";
import { VideoStudioInfrastructureWorkspace } from "@/features/video/VideoStudioInfrastructureWorkspace";
import { getVideoStudioInfrastructureData, type VideoInfraMode } from "@/lib/video-studio-infra-engine";
import { AutonomousNarrationWorkspace } from "@/features/audio/AutonomousNarrationWorkspace";
import { getNarrationWorkspaceData } from "@/lib/narration-engine";
import { AutonomousMusicWorkspace } from "@/features/audio/AutonomousMusicWorkspace";
import { getMusicWorkspaceData } from "@/lib/music-engine";
import { AutonomousAssetOperationsWorkspace } from "@/features/assets/AutonomousAssetOperationsWorkspace";
import { getAssetOperationsOverview } from "@/lib/asset-operations-data";
import { AutoAssembleWorkspace, MasterTimelineWorkspace } from "@/features/timeline/TimelineAssemblyWorkspaces";
import { QualityDashboardWorkspace } from "@/features/quality/QualityDashboardWorkspace";
import { ExportDashboardWorkspace } from "@/features/exports/ExportDashboardWorkspace";
import { PublishingDashboardWorkspace } from "@/features/publishing/PublishingDashboardWorkspace";

export async function ModuleWorkspace({
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

  if (module.slug === "dashboard" && workspace?.slug === "executive-dashboard") {
    const data = await getExecutiveDashboardData();
    return <ExecutiveDashboard data={data} />;
  }

  if (module.slug === "dashboard" && workspace?.slug === "my-workspace") {
    const data = await getMyWorkspaceData();
    return <MyWorkspaceDashboard data={data} />;
  }

  if (module.slug === "dashboard" && workspace?.slug === "active-productions") {
    return <ActiveProductionsPage />;
  }

  if (module.slug === "dashboard" && workspace?.slug === "recent-productions") {
    return <RecentProductionsPage />;
  }

  if (module.slug === "settings" && workspace?.slug === "production-defaults") {
    return <ProductionDefaultsPage />;
  }

  if (module.slug === "opportunity-intelligence") {
    return <OpportunityIntelligenceWorkspace title={title} workspaceLabel={workspace?.label} />;
  }

  if (module.slug === "knowledge-universe") {
    const slug = workspace?.slug ?? "executive-dashboard";
    if (slug === "prediction-engine") {
      return <PredictionEnginePage />;
    }
    if (slug === "knowledge-quality") {
      return <KnowledgeQualityPage />;
    }
    const typeByWorkspace: Partial<Record<string, KnowledgeRecordType>> = {
      "knowledge-graph": "entity",
      "knowledge-repository": "source",
      "knowledge-collections": "collection",
      "topic-library": "topic",
      "entity-explorer": "entity",
      "timeline-explorer": "event",
      "geographic-intelligence": "location",
      "people-intelligence": "person",
      "organization-intelligence": "organization"
    };
    try {
      const initial = await listKnowledgeRecords({ type: typeByWorkspace[slug], pageSize: 25 });
      return <KnowledgeUniversePage slug={slug} initial={initial} />;
    } catch (error) {
      console.error("knowledge.workspace.load.failed", { name: error instanceof Error ? error.name : "Unknown" });
      return <KnowledgeUniversePage slug={slug} error="The MSSQL knowledge store is unavailable. Run migration 013 and retry." />;
    }
  }

<<<<<<< Updated upstream
  if (module.slug === "story-learning" && workspace?.slug === "structure-dashboard") {
    return <StructureDashboard />;
  }

  if (module.slug === "templates" && workspace?.slug === "template-dashboard") {
    return <TemplateDashboard />;
  }

  if (module.slug === "automation" && workspace?.slug && workspace.slug !== "scheduled-productions") { return <AutonomousAutomationWorkspace workspaceSlug={workspace.slug} />; }

  if (module.slug === "automation" && workspace?.slug === "scheduled-productions") { return <AutonomousScheduledProductionsPage />; }

  if (module.slug === "publishing" && workspace?.slug === "scheduler") { return <AutonomousPublishingSchedulerPage />; }

  if (module.slug === "publishing" && workspace?.slug === "publishing-dashboard") {
    try { return <PublishingDashboardWorkspace />; } catch (error) { console.error("publishing.dashboard.load.failed", error); }
  }

  if (module.slug === "timeline" && workspace?.slug === "master-timeline") {
    try { return <MasterTimelineWorkspace />; } catch (error) { console.error("timeline.master.load.failed", error); }
  }

  if (module.slug === "timeline" && workspace?.slug === "auto-assemble") {
    try { return <AutoAssembleWorkspace />; } catch (error) { console.error("timeline.auto-assemble.load.failed", error); }
  }

  if (module.slug === "quality" && workspace?.slug === "quality-dashboard") {
    try { return <QualityDashboardWorkspace />; } catch (error) { console.error("quality.dashboard.load.failed", error); }
  }

  if (module.slug === "exports" && workspace?.slug === "export-dashboard") {
    try { return <ExportDashboardWorkspace />; } catch (error) { console.error("exports.dashboard.load.failed", error); }
  }

  if (module.slug === "collaboration" && workspace?.slug === "assignments") {
    try { return <AutonomousAssignmentsPage />; } catch (error) { console.error("collaboration.assignments.load.failed", error); }
  }

  if (module.slug === "writing" && workspace?.slug === "script-editor") {
    try {
      const data = await getScriptEditorData();
      return <ScriptEditorWorkspace initial={data} />;
    } catch (error) {
      console.error("writing.script-editor.load.failed", error);
      return <ScriptEditorWorkspace error="The MSSQL production store is unavailable. Script editing will recover automatically when the connection returns." />;
    }
  }

  if (module.slug === "writing" && workspace?.slug === "script-intelligence") {
    try {
      const data = await getScriptIntelligenceWorkspaceData();
      return <ScriptIntelligenceWorkspace initial={data} />;
    } catch (error) {
      console.error("writing.script-intelligence.load.failed", error);
      return <ScriptIntelligenceWorkspace error="The MSSQL production store is unavailable. Script intelligence will recover automatically when the connection returns." />;
    }
  }

  if (module.slug === "visuals" && workspace?.slug === "image-generator") {
    try {
      const data = await getImageGeneratorData();
      return <AutonomousImageGeneratorWorkspace initial={data} />;
    } catch (error) {
      console.error("visuals.image-generator.load.failed", error);
      return (
        <AutonomousImageGeneratorWorkspace error="The MSSQL production store is unavailable. Visual generation will recover automatically when the connection returns." />
      );
    }
  }

  const visualInfraModes: Record<string, VisualInfraMode> = {
    "generation-queue": "generation-queue",
    "visual-brief-resolver": "visual-brief-resolver",
    "prompt-intelligence": "prompt-intelligence",
    "regional-visual-intelligence": "regional-visual-intelligence",
    "model-and-workflow-manager": "model-and-workflow-manager",
    "reference-conditioning": "reference-conditioning",
    "image-repair-and-enhancement": "image-repair-and-enhancement",
    "rights-and-provenance": "rights-and-provenance"
  };

  if (module.slug === "visuals" && workspace?.slug && visualInfraModes[workspace.slug]) {
    try {
      const data = await getVisualStudioInfrastructureData();
      return <VisualStudioInfrastructureWorkspace initial={data} mode={visualInfraModes[workspace.slug]} />;
    } catch (error) {
      console.error(`visuals.${workspace.slug}.load.failed`, error);
      return <VisualStudioInfrastructureWorkspace error="The MSSQL production store is unavailable. Visual infrastructure will recover automatically when the connection returns." mode={visualInfraModes[workspace.slug]} />;
    }
  }

  if (module.slug === "storyboard" && workspace?.slug === "storyboard-editor") {
    try {
      const data = await getStoryboardWorkspaceData();
      return <AutonomousStoryboardWorkspace initial={data} />;
    } catch (error) {
      console.error("storyboard.storyboard-editor.load.failed", error);
      return (
        <AutonomousStoryboardWorkspace error="The MSSQL production store is unavailable. Storyboard planning will recover automatically when the connection returns." />
      );
    }
  }

  if (module.slug === "storyboard" && workspace?.slug === "visual-requirement-resolver") {
    try {
      const data = await getAssetRequirementsWorkspaceData();
      return <AssetRequirementsWorkspace initial={data} mode="resolver" />;
    } catch (error) {
      console.error("storyboard.visual-requirement-resolver.load.failed", error);
      return <AssetRequirementsWorkspace error="The MSSQL production store is unavailable. Asset requirement resolution will recover automatically when the connection returns." mode="resolver" />;
    }
  }

  if (module.slug === "storyboard" && workspace?.slug === "asset-requirement-matrix") {
    try {
      const data = await getAssetRequirementsWorkspaceData();
      return <AssetRequirementsWorkspace initial={data} mode="matrix" />;
    } catch (error) {
      console.error("storyboard.asset-requirement-matrix.load.failed", error);
      return <AssetRequirementsWorkspace error="The MSSQL production store is unavailable. Asset requirement matrix generation will recover automatically when the connection returns." mode="matrix" />;
    }
  }

  if (module.slug === "video" && workspace?.slug === "scene-video-generator") {
    try {
      const data = await getSceneVideoWorkspaceData();
      return <AutonomousSceneVideoWorkspace initial={data} />;
    } catch (error) {
      console.error("video.scene-video-generator.load.failed", error);
      return (
        <AutonomousSceneVideoWorkspace error="The MSSQL production store is unavailable. Scene video generation will recover automatically when the connection returns." />
      );
    }
  }

  const videoInfraModes: Record<string, VideoInfraMode> = {
    "motion-consistency": "motion-consistency",
    "video-repair-and-enhancement": "video-repair-and-enhancement"
  };

  if (module.slug === "video" && workspace?.slug && videoInfraModes[workspace.slug]) {
    try {
      const data = await getVideoStudioInfrastructureData();
      return <VideoStudioInfrastructureWorkspace initial={data} mode={videoInfraModes[workspace.slug]} />;
    } catch (error) {
      console.error(`video.${workspace.slug}.load.failed`, error);
      return <VideoStudioInfrastructureWorkspace error="The MSSQL production store is unavailable. Video infrastructure will recover automatically when the connection returns." mode={videoInfraModes[workspace.slug]} />;
    }
  }

  if (module.slug === "audio" && workspace?.slug === "narration-generator") {
    try {
      const data = await getNarrationWorkspaceData();
      return <AutonomousNarrationWorkspace initial={data} />;
    } catch (error) {
      console.error("audio.narration-generator.load.failed", error);
      return (
        <AutonomousNarrationWorkspace error="The MSSQL production store is unavailable. Narration generation will recover automatically when the connection returns." />
      );
    }
  }

  if (module.slug === "audio" && workspace?.slug === "music-generator") {
    try {
      const data = await getMusicWorkspaceData();
      return <AutonomousMusicWorkspace initial={data} />;
    } catch (error) {
      console.error("audio.music-generator.load.failed", error);
      return (
        <AutonomousMusicWorkspace error="The MSSQL production store is unavailable. Music generation will recover automatically when the connection returns." />
      );
    }
  }

  if (module.slug === "assets" && workspace?.slug === "all-assets") {
    try {
      const data = await getAssetOperationsOverview();
      return <AutonomousAssetOperationsWorkspace initial={data} />;
    } catch (error) {
      console.error("assets.all-assets.load.failed", error);
      return (
        <AutonomousAssetOperationsWorkspace
          initialError="The MSSQL asset store is unavailable. Asset operations will recover automatically when the connection returns."
        />
      );
    }
=======
  const href = workspace ? `/${moduleSlug}/${workspaceSlug}` : `/${moduleSlug}`;
  if (!isWorkspaceRouteImplemented(href)) {
    return <ComingSoonPage title={title} href={href} />;
>>>>>>> Stashed changes
  }

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
                href={module.slug === "productions" ? `/production-studio/${child.slug}` : module.slug === "intelligence" ? `/content-intelligence/${child.slug}` : `/${module.slug}/${child.slug}`}
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

function OpportunityIntelligenceWorkspace({
  title,
  workspaceLabel
}: {
  title: string;
  workspaceLabel?: string;
}) {
  const readyCount = opportunityPortfolio.filter((item) => ["scheduled", "ready", "producing"].includes(item.state)).length;
  const averageScore = Math.round(
    opportunityPortfolio.reduce((total, item) => total + item.overallScore, 0) / opportunityPortfolio.length
  );

  return (
    <>
      <section className="page-header">
        <span className="eyebrow">Opportunity Intelligence Center</span>
        <h2>{title}</h2>
        <p>
          Autonomous executive producer intelligence that discovers what should be produced next, researches why it
          matters, scores the opportunity, builds a multi-format plan, schedules the work, and feeds approved ideas into
          the production pipeline.
        </p>
      </section>

      <section className="grid cols-4">
        {[
          { label: "Total Opportunities", value: opportunityPortfolio.length, detail: "Active portfolio items" },
          { label: "Ready Pipeline", value: readyCount, detail: "Scheduled, ready, or producing" },
          { label: "AI Confidence", value: `${averageScore}%`, detail: "Average opportunity score" },
          { label: "Discovery Sources", value: opportunitySignalSources.length, detail: "Autonomous signal engines" }
        ].map((metric) => (
          <article className="card" key={metric.label}>
            <div className="metric">{metric.value}</div>
            <h3>{metric.label}</h3>
            <p>{metric.detail}</p>
          </article>
        ))}
      </section>

      <section className="grid cols-3" style={{ marginTop: 16 }}>
        <article className="card">
          <h3>Executive Producer Loop</h3>
          <div className="stage-list">
            {[
              ["Discover", "Scan trend, gap, human interest, mystery, and life exploration signals."],
              ["Evaluate", "Score curiosity, education, emotion, ROI, evergreen value, and platform fit."],
              ["Pre-plan", "Create recommended formats, scripts, channels, budget, schedule, and campaign fit."],
              ["Launch", "Move approved opportunities into production, QA, publishing, and learning workflows."]
            ].map(([label, description], index) => (
              <div className="stage" key={label}>
                <span className="stage-number">{index + 1}</span>
                <span>
                  <h3>{label}</h3>
                  <p>{description}</p>
                </span>
                <span className="status">Auto</span>
              </div>
            ))}
          </div>
        </article>

        <article className="card">
          <h3>{workspaceLabel === "Life Explorer Engine" ? "Life Explorer Focus" : "Signal Engines"}</h3>
          <div className="signal-grid">
            {opportunitySignalSources.map((source) => (
              <div className="signal" key={source.id}>
                <span className="signal-icon">{signalIcon(source.id)}</span>
                <span>
                  <strong>{source.label}</strong>
                  <small>{source.cadence}</small>
                  <p>{source.coverage.slice(0, 4).join(", ")}</p>
                </span>
              </div>
            ))}
          </div>
        </article>

        <article className="card">
          <h3>Autonomy Modes</h3>
          <div className="stage-list">
            {autonomyModes.map((mode) => (
              <div className="stage compact-stage" key={mode.id}>
                <CheckCircle2 size={22} color="#08645f" aria-hidden="true" />
                <span>
                  <h3>{mode.label}</h3>
                  <p>{mode.description}</p>
                </span>
                <span className="status">Policy</span>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="grid cols-2" style={{ marginTop: 16 }}>
        <article className="card">
          <h3>Opportunity Portfolio</h3>
          <div className="stage-list">
            {opportunityPortfolio.map((item) => (
              <div className="opportunity-row" key={item.id}>
                <div>
                  <h3>{item.title}</h3>
                  <p>
                    {item.category} / {item.publishWindow} / {item.expectedReturn}
                  </p>
                  <div className="pill-row">
                    {item.productionFormats.slice(0, 4).map((format) => (
                      <span className="pill" key={format}>
                        {format}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="score-stack">
                  <strong>{item.overallScore}</strong>
                  <span className="status">{item.state}</span>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="card">
          <h3>Scoring Engine</h3>
          <div className="score-list">
            {opportunityScoreModel.map((score) => (
              <div className="score-item" key={score.label}>
                <div>
                  <strong>{score.label}</strong>
                  <p>{score.description}</p>
                </div>
                <span>{score.weight}%</span>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="grid cols-3" style={{ marginTop: 16 }}>
        <article className="card">
          <h3>Portfolio States</h3>
          <div className="state-rail">
            {opportunityStates.map((state) => (
              <span className="pill" key={state}>
                {state}
              </span>
            ))}
          </div>
        </article>

        <article className="card">
          <h3>Editorial Board</h3>
          <div className="pill-row">
            {executiveProducerAgents.map((agent) => (
              <span className="pill" key={agent}>
                {agent}
              </span>
            ))}
          </div>
          <p style={{ marginBottom: 0 }}>
            Opportunities advance when strategy, education, audience, business, compliance, and publishing agents agree
            that the idea is valuable and feasible.
          </p>
        </article>

        <article className="card">
          <h3>Evergreen Knowledge Bank</h3>
          <div className="pill-row">
            {evergreenKnowledgeBank.map((topic) => (
              <span className="pill" key={topic}>
                {topic}
              </span>
            ))}
          </div>
        </article>
      </section>

      <section className="grid cols-2" style={{ marginTop: 16 }}>
        <article className="card">
          <h3>Campaign Builder</h3>
          <div className="stage-list">
            {opportunityCampaigns.map((campaign) => (
              <div className="campaign" key={campaign.id}>
                <h3>{campaign.title}</h3>
                <p>Anchor: {campaign.anchorOpportunity}</p>
                <div className="pill-row">
                  {campaign.outputs.map((output) => (
                    <span className="pill" key={output}>
                      {output}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="card">
          <h3>Multi-Format Planning</h3>
          <div className="format-grid">
            {multiFormatPlan.map((item) => (
              <span className="format-tile" key={`${item.format}-${item.label}`}>
                {item.label}
              </span>
            ))}
          </div>
        </article>
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <h3>Workflow Integration</h3>
        <div className="grid cols-4">
          {["Create Production Project", "Assign AI Team", "Generate Script and Storyboard", "Generate Media and Timeline", "Run QA", "Publish", "Learn"].map(
            (step, index) => (
              <div className="stage" key={step}>
                <span className="stage-number">{index + 1}</span>
                <span>
                  <h3>{step}</h3>
                  <p>Triggered when the opportunity is approved for production.</p>
                </span>
                <span className="status">Ready</span>
              </div>
            )
          )}
        </div>
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <h3>Category Coverage</h3>
        <div className="pill-row">
          {opportunityCategories.map((category) => (
            <span className="pill" key={category}>
              {category}
            </span>
          ))}
        </div>
      </section>
    </>
  );
}

function signalIcon(id: string) {
  const props = { size: 17, "aria-hidden": true };
  if (id.includes("global")) return <Radar {...props} />;
  if (id.includes("human")) return <Sparkles {...props} />;
  if (id.includes("mystery")) return <Telescope {...props} />;
  if (id.includes("curiosity")) return <Lightbulb {...props} />;
  if (id.includes("gap")) return <Gauge {...props} />;
  if (id.includes("life")) return <BrainCircuit {...props} />;
  return <Network {...props} />;
}

function KnowledgeUniverseWorkspace({
  title,
  workspaceLabel
}: {
  title: string;
  workspaceLabel?: string;
}) {
  const relationshipCount = knowledgeGraphRelationships.length;
  const nodeCount = knowledgeGraphNodes.length;

  return (
    <>
      <section className="page-header">
        <span className="eyebrow">Knowledge Universe & World Model Engine</span>
        <h2>{title}</h2>
        <p>
          Permanent intelligence, memory, semantic search, reasoning, prediction, quality, and governance layer for every
          studio agent and production workflow. The studio thinks through connected knowledge instead of isolated files.
        </p>
      </section>

      <section className="grid cols-4">
        {knowledgeUniverseMetrics.map((metric) => (
          <article className="card" key={metric.label}>
            <div className="metric">{metric.value}</div>
            <h3>{metric.label}</h3>
            <p>{metric.detail}</p>
          </article>
        ))}
      </section>

      <section className="grid cols-3" style={{ marginTop: 16 }}>
        <article className="card">
          <h3>Core Architecture</h3>
          <div className="stage-list">
            {knowledgeCoreEngines.map((engine, index) => (
              <div className="stage" key={engine.label}>
                <span className="stage-number">{index + 1}</span>
                <span>
                  <h3>{engine.label}</h3>
                  <p>{engine.description}</p>
                </span>
                <span className="status">Core</span>
              </div>
            ))}
          </div>
        </article>

        <article className="card knowledge-graph-card">
          <h3>{workspaceLabel === "Knowledge Graph" ? "Interactive Graph Model" : "Knowledge Network"}</h3>
          <div className="graph-canvas" aria-label="Knowledge graph sample">
            {knowledgeGraphNodes.map((node, index) => (
              <span className={`graph-node graph-node-${index + 1}`} key={node.id}>
                {node.label}
              </span>
            ))}
          </div>
          <p>
            {nodeCount} connected sample nodes and {relationshipCount} relationship edges model how concepts move from
            AI to manufacturing, Africa, and economic development.
          </p>
        </article>

        <article className="card">
          <h3>Semantic Reasoning</h3>
          <div className="search-examples">
            {[
              "Show technologies likely to change Africa before 2040.",
              "Which engineering discoveries affected transportation?",
              "What documentaries should follow Industry 4.0?",
              "Which knowledge is becoming outdated?"
            ].map((example) => (
              <div className="query-chip" key={example}>
                <BrainCircuit size={16} aria-hidden="true" />
                <span>{example}</span>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="grid cols-2" style={{ marginTop: 16 }}>
        <article className="card">
          <h3>Subject Domains</h3>
          <div className="domain-grid">
            {knowledgeDomains.map((domain) => (
              <div className="domain-card" key={domain.id}>
                <div>
                  <strong>{domain.label}</strong>
                  <p>{domain.objects.toLocaleString()} objects</p>
                </div>
                <div className="mini-bars" aria-label={`${domain.label} confidence and freshness`}>
                  <span style={{ width: `${domain.confidence}%` }} />
                  <span style={{ width: `${domain.freshness}%` }} />
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="card">
          <h3>Relationship Engine</h3>
          <div className="pill-row">
            {knowledgeRelationshipTypes.map((relationship) => (
              <span className="pill" key={relationship}>
                {relationship}
              </span>
            ))}
          </div>
          <div className="stage-list" style={{ marginTop: 14 }}>
            {knowledgeGraphRelationships.slice(0, 5).map((relationship) => (
              <div className="stage compact-stage" key={`${relationship.from}-${relationship.to}`}>
                <Network size={22} color="#08645f" aria-hidden="true" />
                <span>
                  <h3>{relationship.label}</h3>
                  <p>
                    {relationship.from} to {relationship.to}
                  </p>
                </span>
                <span className="status">{relationship.confidence}</span>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="grid cols-3" style={{ marginTop: 16 }}>
        <article className="card">
          <h3>World Model</h3>
          <div className="world-model">
            {[
              "Electric vehicles grow",
              "Battery demand increases",
              "Lithium mining increases",
              "African mining opportunities increase",
              "Content opportunities increase"
            ].map((step, index) => (
              <div className="world-step" key={step}>
                <span>{index + 1}</span>
                <strong>{step}</strong>
              </div>
            ))}
          </div>
        </article>

        <article className="card">
          <h3>Prediction Engine</h3>
          <div className="stage-list">
            {knowledgePredictions.map((prediction) => (
              <div className="prediction" key={prediction.id}>
                <div>
                  <h3>{prediction.title}</h3>
                  <p>{prediction.implication}</p>
                </div>
                <div className="score-stack">
                  <strong>{prediction.confidence}</strong>
                  <span className="status">{prediction.horizon}</span>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="card">
          <h3>AI Memory</h3>
          <div className="stage-list">
            {[
              "Every research",
              "Every production",
              "Every success and failure",
              "Every user correction",
              "Every audience response",
              "Every AI decision",
              "Every improvement"
            ].map((memory) => (
              <div className="stage compact-stage" key={memory}>
                <CheckCircle2 size={22} color="#08645f" aria-hidden="true" />
                <span>
                  <h3>{memory}</h3>
                  <p>Stored as reusable institutional learning.</p>
                </span>
                <span className="status">Memory</span>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="grid cols-2" style={{ marginTop: 16 }}>
        <article className="card">
          <h3>Knowledge Collections</h3>
          <div className="stage-list">
            {knowledgeCollections.map((collection) => (
              <div className="campaign" key={collection.id}>
                <h3>{collection.title}</h3>
                <p>{collection.summary}</p>
                <div className="pill-row">
                  {collection.includes.map((item) => (
                    <span className="pill" key={item}>
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="card">
          <h3>Knowledge Quality</h3>
          <div className="quality-grid">
            {knowledgeQualityDimensions.map((dimension, index) => (
              <div className="quality-tile" key={dimension}>
                <Gauge size={16} aria-hidden="true" />
                <span>{dimension}</span>
                <strong>{index % 3 === 0 ? "Verified" : index % 3 === 1 ? "Tracked" : "Scored"}</strong>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="grid cols-3" style={{ marginTop: 16 }}>
        <article className="card">
          <h3>Knowledge Governance</h3>
          <div className="pill-row">
            {knowledgeGovernanceControls.map((control) => (
              <span className="pill" key={control}>
                {control}
              </span>
            ))}
          </div>
        </article>

        <article className="card">
          <h3>Dedicated Agents</h3>
          <div className="pill-row">
            {knowledgeAgents.map((agent) => (
              <span className="pill" key={agent}>
                {agent}
              </span>
            ))}
          </div>
        </article>

        <article className="card">
          <h3>Database Design</h3>
          <div className="pill-row">
            {knowledgeDatabaseObjects.map((object) => (
              <span className="pill" key={object}>
                {object}
              </span>
            ))}
          </div>
        </article>
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <h3>Platform Intelligence Flow</h3>
        <div className="grid cols-4">
          {[
            "Knowledge Universe",
            "Opportunity Intelligence",
            "Production Workflow",
            "Publishing",
            "Audience Feedback",
            "Learning Engine",
            "Knowledge Universe"
          ].map((step, index) => (
            <div className="stage" key={`${step}-${index}`}>
              <span className="stage-number">{index + 1}</span>
              <span>
                <h3>{step}</h3>
                <p>Every output enriches the permanent world model.</p>
              </span>
              <span className="status">Loop</span>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

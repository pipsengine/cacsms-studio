"use client";

import { useMemo, useState } from "react";
import { Bot, CheckCircle2, FileText, Languages, SlidersHorizontal, Sparkles, Timer, Users } from "lucide-react";
import { contentTypeDefinitions, getContentTypeDefinition, productionPipeline } from "@cacsms/contracts";
import type { ProductionFormat } from "@cacsms/contracts";

const wizardSteps = [
  { label: "Select content type", icon: Sparkles },
  { label: "Enter topic or source material", icon: FileText },
  { label: "Select audience", icon: Users },
  { label: "Choose language", icon: Languages },
  { label: "Set duration and format", icon: Timer },
  { label: "Choose tone and visual style", icon: SlidersHorizontal },
  { label: "Select automation level", icon: Bot },
  { label: "Generate production", icon: CheckCircle2 }
];

export function ProductionWizard() {
  const [contentType, setContentType] = useState<ProductionFormat>("documentary");
  const definition = useMemo(() => getContentTypeDefinition(contentType), [contentType]);

  return (
    <>
      <section className="page-header">
        <span className="eyebrow">Create Production Wizard</span>
        <h2>Select a production type and load its workflow.</h2>
        <p>
          The selected type dynamically determines required inputs, agent team, script structure, scene rules,
          quality gates, export modes, and publishing destinations.
        </p>
      </section>

      <section className="grid cols-2">
        <article className="card">
          <h3>Production Setup</h3>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="content-type">Content type</label>
              <select
                id="content-type"
                value={contentType}
                onChange={(event) => setContentType(event.target.value as ProductionFormat)}
              >
                {contentTypeDefinitions.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="audience">Audience</label>
              <input id="audience" placeholder="Example: first-time business owners" />
            </div>
            <div className="field">
              <label htmlFor="language">Language</label>
              <input id="language" placeholder="Example: English" />
            </div>
            <div className="field">
              <label htmlFor="duration">Duration and format</label>
              <input id="duration" placeholder="Example: 8 minutes, 16:9" />
            </div>
            <div className="field">
              <label htmlFor="tone">Tone and visual style</label>
              <input id="tone" placeholder="Example: cinematic, warm, modern" />
            </div>
            <div className="field">
              <label htmlFor="automation">Automation level</label>
              <select id="automation" defaultValue="supervised">
                <option value="manual">Manual assist</option>
                <option value="supervised">Supervised autonomous</option>
                <option value="full">Full autonomous draft</option>
              </select>
            </div>
            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <label htmlFor="source">Topic or source material</label>
              <textarea id="source" placeholder="Paste a topic, document excerpt, lesson brief, story idea, or instruction." />
            </div>
          </div>
          <button className="button primary" type="button" style={{ marginTop: 16 }}>
            <Sparkles size={16} aria-hidden="true" />
            Generate production
          </button>
        </article>

        <article className="card">
          <h3>Wizard Steps</h3>
          <div className="stage-list">
            {wizardSteps.map((step, index) => {
              const Icon = step.icon;
              return (
                <div className="stage" key={step.label}>
                  <span className="stage-number">{index + 1}</span>
                  <span>
                    <h3>{step.label}</h3>
                    <p>Captured before production generation.</p>
                  </span>
                  <Icon size={18} aria-hidden="true" />
                </div>
              );
            })}
          </div>
        </article>
      </section>

      {definition ? (
        <section className="grid cols-2" style={{ marginTop: 16 }}>
          <article className="card">
            <h3>{definition.label}</h3>
            <p className="muted">{definition.summary}</p>
            <h3 style={{ marginTop: 18 }}>Required Inputs</h3>
            <div className="pill-row">
              {definition.requiredInputs.map((input) => (
                <span className="pill" key={input}>
                  {input}
                </span>
              ))}
            </div>
            <h3 style={{ marginTop: 18 }}>Script Structure</h3>
            <div className="stage-list">
              {definition.scriptStructure.map((item, index) => (
                <div className="stage" key={item}>
                  <span className="stage-number">{index + 1}</span>
                  <span>
                    <h3>{item}</h3>
                    <p>Generated as an editable writing and review block.</p>
                  </span>
                  <span className="status">Loaded</span>
                </div>
              ))}
            </div>
          </article>

          <article className="card">
            <h3>Agent Team</h3>
            <div className="pill-row">
              {definition.aiAgentTeam.map((agent) => (
                <span className="pill" key={agent}>
                  {agent}
                </span>
              ))}
            </div>
            <h3 style={{ marginTop: 18 }}>QA Checks</h3>
            <div className="stage-list">
              {definition.qaChecks.map((check) => (
                <div className="stage" key={check.label}>
                  <CheckCircle2 size={22} color="#08645f" aria-hidden="true" />
                  <span>
                    <h3>{check.label}</h3>
                    <p>Level: {check.level}</p>
                  </span>
                  <span className="status">{check.level}</span>
                </div>
              ))}
            </div>
          </article>

          <article className="card">
            <h3>Workflow Stages</h3>
            <div className="stage-list">
              {definition.workflowStages.map((stageId, index) => {
                const stage = productionPipeline.find((item) => item.id === stageId);
                return (
                  <div className="stage" key={stageId}>
                    <span className="stage-number">{index + 1}</span>
                    <span>
                      <h3>{stage?.label ?? stageId}</h3>
                      <p>{stage?.description ?? "Configured workflow stage."}</p>
                    </span>
                    <span className="status">Queued</span>
                  </div>
                );
              })}
            </div>
          </article>

          <article className="card">
            <h3>Export and Publishing</h3>
            <h3 style={{ marginTop: 0 }}>Export Modes</h3>
            <div className="pill-row">
              {definition.exportModes.map((mode) => (
                <span className="pill" key={mode}>
                  {mode}
                </span>
              ))}
            </div>
            <h3 style={{ marginTop: 18 }}>Output Formats</h3>
            <div className="pill-row">
              {definition.outputFormats.map((format) => (
                <span className="pill" key={format}>
                  {format}
                </span>
              ))}
            </div>
            <h3 style={{ marginTop: 18 }}>Destinations</h3>
            <div className="pill-row">
              {definition.publishingDestinations.map((destination) => (
                <span className="pill" key={destination}>
                  {destination}
                </span>
              ))}
            </div>
          </article>
        </section>
      ) : null}
    </>
  );
}

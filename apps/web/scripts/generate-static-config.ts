/**
 * Generates static navigation config from @cacsms/contracts.
 * Run: pnpm generate:static-config
 */
import { writeFileSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { navigationModules, productionLifecycleStages, lifecyclePhases } from "@cacsms/contracts";

const root = resolve(import.meta.dirname, "..");
const sidebarPath = resolve(root, "public/shared-sidebar.js");
const workflowHtmlPath = resolve(root, "public/production-workflow/index.html");

function moduleIcon(label: string) {
  return label.split(/\s+/).map((part) => part[0]?.toUpperCase() ?? "").join("").slice(0, 2) || "WS";
}

const generatedModules = navigationModules.map((module) => [
  moduleIcon(module.label),
  module.label,
  module.children.map((child) => child.label)
]);

let sidebar = readFileSync(sidebarPath, "utf8");
const modulesPattern = /const modules = \[[\s\S]*?\n\];/;
if (!modulesPattern.test(sidebar)) {
  throw new Error("Could not locate modules array in shared-sidebar.js");
}
sidebar = sidebar.replace(modulesPattern, `const modules = ${JSON.stringify(generatedModules, null, 2)};`);
writeFileSync(sidebarPath, sidebar, "utf8");

const stageCards = productionLifecycleStages
  .map(
    (stage) =>
      `<a class="stage-card" href="/production-workflow/${stage.id}"><span class="stage-num">${stage.order}</span><strong>${stage.label}</strong><p>${stage.description}</p><em data-stage="${stage.id}">${stage.statusLabel}</em></a>`
  )
  .join("\n          ");

const phaseBand = lifecyclePhases
  .map((phase) => `<span class="phase"><b>${phase.label}</b><small>${phase.description}</small></span>`)
  .join("\n          ");

const workflowHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Production Life Cycle | CACSMS</title>
  <link rel="stylesheet" href="/production-workflow/styles.css" />
</head>
<body>
  <main class="fallback-page">
    <header>
      <h1>Production Life Cycle</h1>
      <p>Generated from @cacsms/contracts · ${new Date().toISOString()}</p>
    </header>
    <section class="phase-band">${phaseBand}</section>
    <section class="stage-grid">${stageCards}</section>
    <p class="note">Live counts available at <a href="/production-workflow/discover">/production-workflow/discover</a></p>
  </main>
</body>
</html>
`;

writeFileSync(workflowHtmlPath, workflowHtml, "utf8");
console.log("Generated shared-sidebar.js modules from contracts");
console.log("Generated production-workflow/index.html from contracts");

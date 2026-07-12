# CACSMS Autonomous Media Studio

CACSMS Studio transforms a topic, idea, document, lesson, story, or instruction into complete, editable, and publishable multimedia content.

The repository is a domain-driven monorepo. The web app is intentionally powered by configuration for navigation, production types, workflow stages, agent teams, quality rules, and export modes.

## Production Pipeline

1. Content Intelligence
2. Script and Structure
3. Scene Planning
4. Visual Production
5. Video and Animation
6. Voice, Music and Sound
7. Timeline Assembly
8. Quality Assurance
9. Hybrid Export
10. CapCut / Direct Publishing

## Core Rule

Production types are configuration-driven, not hard-coded. Adding a new format such as `Safety Training Video` should require a new content-type definition, templates, QA policies, and workflow settings, not a separate application.

## Apps

- `apps/web`: Next.js studio UI, production wizard, sidebar workspaces, workflow dashboards.
- `apps/api`: API module scaffold for platform domains.
- Worker app folders are reserved for orchestration, rendering, media generation, publishing, and scheduling.

## Packages

- `packages/contracts`: Shared TypeScript contracts for content-type definitions, navigation, workflow, QA, export, publishing, and agents.
- Domain packages are scaffolded for future engines such as research, writing, story, visual, video, audio, timeline, QA, export, and publishing.

## Commands

```bash
pnpm install
pnpm dev
pnpm typecheck
```

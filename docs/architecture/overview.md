# Architecture Overview

CACSMS Studio is a domain-driven monorepo organized around production capabilities rather than sidebar pages.

The most important platform rule is that production types are configuration-driven. The contracts package defines each production format with required inputs, workflow stages, AI agent teams, script structures, scene rules, visual requirements, audio requirements, QA checks, duration rules, output formats, and publishing destinations.

The web app reads those definitions to render the creation wizard and operational workspaces. Backend modules and workers are scaffolded around the same domains so the UI, API, workers, and packages can share definitions as implementation deepens.

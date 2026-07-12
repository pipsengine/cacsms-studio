import { createDomainModule } from "../../common/module-manifest";

export const contentTypesModule = createDomainModule({
  name: "content-types",
  responsibility: "Load production type definitions, workflow stages, templates, agents, QA policies, exports, and destinations.",
  entities: ["ContentTypeDefinition", "WorkflowDefinition", "QualityPolicy", "ExportPolicy"],
  commands: ["RegisterContentType", "UpdateContentTypeDefinition", "DisableContentType"],
  queries: ["ListContentTypes", "GetContentTypeDefinition", "ResolveWorkflowForType"],
  events: ["ContentTypeRegistered", "ContentTypeUpdated", "WorkflowResolved"]
});

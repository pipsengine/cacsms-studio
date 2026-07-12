import { createDomainModule } from "../../common/module-manifest";

export const productionsModule = createDomainModule({
  name: "productions",
  responsibility: "Own production lifecycle from creation wizard through archive and calendar planning.",
  entities: ["Production", "ProductionBrief", "ProductionPipelineState", "ProductionSchedule"],
  commands: ["CreateProduction", "UpdateProductionBrief", "QueueProduction", "ArchiveProduction"],
  queries: ["ListProductions", "GetProduction", "GetProductionPipeline", "GetProductionCalendar"],
  events: ["ProductionCreated", "ProductionQueued", "ProductionCompleted", "ProductionArchived"]
});

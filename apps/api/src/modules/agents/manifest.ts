import { createDomainModule } from "../../common/module-manifest";

export const agentsModule = createDomainModule({
  name: "agents",
  responsibility: "Coordinate AI agent teams, prompts, tools, model routing, logs, costs, knowledge, memory, and performance.",
  entities: ["Agent", "AgentTeam", "Prompt", "Tool", "ModelRoute", "AgentRun"],
  commands: ["CreateAgentTeam", "AssignAgent", "StartAgentRun", "RecordAgentCost"],
  queries: ["ListAgents", "GetAgentTeam", "GetAgentLogs", "GetAgentPerformance"],
  events: ["AgentRunStarted", "AgentRunCompleted", "AgentRunFailed", "AgentCostRecorded"]
});

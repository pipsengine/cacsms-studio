import {getProductionOrchestrationStatus, type OrchestrationStatus} from "@/lib/autonomous-production-orchestrator";
import {ScheduledProductionsWorkspace} from "./ScheduledProductionsWorkspace";

export async function AutonomousScheduledProductionsPage(){
  let status:OrchestrationStatus|null=null;
  let error:string|null=null;
  try{status=await getProductionOrchestrationStatus();}catch(cause){error=cause instanceof Error?cause.message:"Live scheduler telemetry is unavailable.";}
  return <ScheduledProductionsWorkspace status={status} error={error}/>;
}

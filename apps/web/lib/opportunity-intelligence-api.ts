import type { DiscoveryData, DiscoverySettings, OpportunityDashboardData, OpportunityRecord, OpportunitySignal } from "@/types/opportunity-intelligence";
async function json<T>(url:string,init?:RequestInit):Promise<T>{const response=await fetch(url,{cache:"no-store",headers:{"Content-Type":"application/json",Accept:"application/json",...(init?.headers||{})},...init});const body=await response.json().catch(()=>null);if(!response.ok)throw new Error(body?.message||`Request failed (${response.status})`);return body as T;}
export const loadOpportunityDashboard=(signal?:AbortSignal)=>json<OpportunityDashboardData>("/api/opportunity-intelligence/dashboard",{signal});
export const discoverOpportunity=()=>json<OpportunityRecord>("/api/opportunity-intelligence/dashboard",{method:"POST",body:JSON.stringify({action:"discover"})});
export const actOnOpportunity=(id:string,action:"open"|"initiative")=>json<{status:string}>("/api/opportunity-intelligence/dashboard",{method:"POST",body:JSON.stringify({id,action})});
export const loadDiscovery=(signal?:AbortSignal)=>json<DiscoveryData>("/api/opportunity-intelligence/discovery",{signal});
export const saveSettings=(settings:DiscoverySettings)=>json<{status:string}>("/api/opportunity-intelligence/discovery",{method:"PATCH",body:JSON.stringify(settings)});
export const runScan=()=>json<OpportunitySignal>("/api/opportunity-intelligence/discovery",{method:"POST",body:JSON.stringify({action:"scan"})});
export const promoteSignal=(signalId:string)=>json<OpportunityRecord>("/api/opportunity-intelligence/discovery",{method:"POST",body:JSON.stringify({action:"create-opportunity",signalId})});

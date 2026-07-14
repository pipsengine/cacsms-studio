import type {EngineData,EngineItem,EngineSettings} from "@/types/intelligence-engine";
async function json<T>(url:string,init?:RequestInit):Promise<T>{const response=await fetch(url,{cache:"no-store",headers:{"Content-Type":"application/json",Accept:"application/json"},...init});const body=await response.json().catch(()=>null);if(!response.ok)throw new Error(body?.message||`Request failed (${response.status})`);return body as T;}
const url=(slug:string)=>`/api/opportunity-intelligence/engines/${slug}`;
export const loadEngine=(slug:string,signal?:AbortSignal)=>json<EngineData>(url(slug),{signal});
export const saveEngine=(slug:string,settings:EngineSettings)=>json<{status:string}>(url(slug),{method:"PATCH",body:JSON.stringify(settings)});
export const scanEngine=(slug:string)=>json<EngineItem>(url(slug),{method:"POST",body:JSON.stringify({action:"scan"})});
export const openEngine=(slug:string,id:string)=>json<{status:string}>(url(slug),{method:"POST",body:JSON.stringify({action:"open",id})});
export const createEngineOpportunity=(slug:string,id:string)=>json<{opportunityId:string}>(url(slug),{method:"POST",body:JSON.stringify({action:"create-opportunity",id})});

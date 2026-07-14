import type {GapData,ScoringData,ScoringWeight} from "@/types/gap-scoring";
async function json<T>(url:string,init?:RequestInit):Promise<T>{const response=await fetch(url,{...init,headers:{"Content-Type":"application/json",...(init?.headers||{})}});const body=await response.json();if(!response.ok)throw new Error(body.message||"Request failed.");return body as T;}
export const loadGap=()=>json<GapData>("/api/opportunity-intelligence/gap-detection");
export const scanGaps=()=>json<{id:string}>("/api/opportunity-intelligence/gap-detection",{method:"POST",body:JSON.stringify({action:"scan"})});
export const createGapOpportunity=(id:string)=>json<{opportunityId:string}>("/api/opportunity-intelligence/gap-detection",{method:"POST",body:JSON.stringify({action:"create-opportunity",id})});
export const loadScoring=()=>json<ScoringData>("/api/opportunity-intelligence/scoring-engine");
export const updateWeights=(weights:ScoringWeight[])=>json<{status:string}>("/api/opportunity-intelligence/scoring-engine",{method:"PATCH",body:JSON.stringify({weights})});
export const executeScoring=()=>json<ScoringData>("/api/opportunity-intelligence/scoring-engine",{method:"POST",body:JSON.stringify({action:"run"})});

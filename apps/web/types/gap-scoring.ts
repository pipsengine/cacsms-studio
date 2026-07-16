import type {EngineItem,EngineMetric} from "@/types/intelligence-engine";

export interface GapData { metrics:EngineMetric[]; items:EngineItem[]; lastRunAt:string|null }
export interface ScoringWeight { key:string; label:string; description:string; weight:number; rating:"Low"|"Medium"|"High" }
export interface ScoringAutonomy {
  enabled:boolean;state:"running"|"healthy"|"waiting"|"failed";algorithmVersion:string;intervalSeconds:number;nextRunAt:string|null;
  thresholds:{promote:number;prioritize:number};
  lastRun:null|{status:string;trigger:string;scanned:number;created:number;updated:number;promoted:number;enriching:number;averageScore:number;averageConfidence:number;completedAt:string|null;error:string|null};
  recentDecisions:Array<{id:number;action:string;score:number;confidence:number;title:string|null;createdAt:string}>;
}
export interface ScoringData extends GapData { modelName:string; weights:ScoringWeight[]; averageScore:number; distribution:{exceptional:number;strong:number;moderate:number;low:number};autonomy:ScoringAutonomy }

import type {EngineItem,EngineMetric} from "@/types/intelligence-engine";

export interface GapData { metrics:EngineMetric[]; items:EngineItem[]; lastRunAt:string|null }
export interface ScoringWeight { key:string; label:string; description:string; weight:number; rating:"Low"|"Medium"|"High" }
export interface ScoringData extends GapData { modelName:string; weights:ScoringWeight[]; averageScore:number; distribution:{exceptional:number;strong:number;moderate:number;low:number} }

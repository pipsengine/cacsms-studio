export interface EngineMetric { value:string; label:string; detail:string; tone:string }
export interface EngineItem { id:string; title:string; subtitle:string; category:string; score:number; state:string; attributes:Record<string,string|number>; risk:boolean; watchlisted:boolean }
export interface EngineSettings { primaryMarket:string; signalSensitivity:number; autoCreateOpportunities:boolean; lastRunAt:string|null }
export interface EngineData { metrics:EngineMetric[]; settings:EngineSettings; items:EngineItem[] }
export interface EngineDefinition {
 slug:string; title:string; subtitle:string; center:string; centerSubtitle:string; primaryAction:string; icon:string;
 registry:string; registrySubtitle:string; totalLabel:string; tabs:string[]; search:string; sort:string;
 columns:Array<{label:string;key:string}>; selectedTitle:string; selectedAction:string; createAction:string;
 overviewTitle:string; briefTitle:string; briefTag:string; brief:string; summaryCards:Array<[string,string,string]>;
}

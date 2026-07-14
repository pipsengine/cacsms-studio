import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DiscoveryEngine } from "@/components/opportunity-intelligence/DiscoveryEngine";
import { OpportunityDashboard } from "@/components/opportunity-intelligence/OpportunityDashboard";
import { IntelligenceEnginePage } from "@/components/opportunity-intelligence/IntelligenceEnginePage";
import { GapDetectionPage } from "@/components/opportunity-intelligence/GapDetectionPage";
import { OpportunityScoringPage } from "@/components/opportunity-intelligence/OpportunityScoringPage";
import { OperationalPage } from "@/components/opportunity-intelligence/OperationalPage";
import { engineDefinitions } from "@/lib/intelligence-engine-definitions";
import { isOperationalSlug } from "@/lib/opportunity-operations-data";
const operationalTitles:Record<string,string>={"editorial-board":"Editorial Board","opportunity-scheduler":"Opportunity Scheduler","autonomy-modes":"Autonomy Modes","learning-engine":"Learning Engine","multi-format-planner":"Multi-Format Planner","executive-recommendations":"Executive Recommendations","opportunity-portfolio":"Opportunity Portfolio","campaign-builder":"Campaign Builder","evergreen-knowledge-bank":"Evergreen Knowledge Bank"};
export async function generateMetadata({params}:{params:Promise<{slug:string}>}):Promise<Metadata>{const{slug}=await params;if(slug==="discovery-engine")return{title:"Discovery Engine | CACSMS"};if(slug==="opportunity-dashboard")return{title:"Opportunity Dashboard | CACSMS"};if(slug==="gap-detection")return{title:"Gap Detection | CACSMS"};if(slug==="scoring-engine")return{title:"Opportunity Scoring Engine | CACSMS"};if(isOperationalSlug(slug))return{title:`${operationalTitles[slug]} | CACSMS`};const definition=engineDefinitions[slug];return definition?{title:`${definition.title} | CACSMS`,description:definition.subtitle}:{};}
export default async function Page({params}:{params:Promise<{slug:string}>}){const {slug}=await params;if(slug==="opportunity-dashboard")return <OpportunityDashboard/>;if(slug==="discovery-engine")return <DiscoveryEngine/>;if(slug==="gap-detection")return <GapDetectionPage/>;if(slug==="scoring-engine")return <OpportunityScoringPage/>;if(isOperationalSlug(slug))return <OperationalPage slug={slug}/>;if(engineDefinitions[slug])return <IntelligenceEnginePage slug={slug}/>;notFound();}

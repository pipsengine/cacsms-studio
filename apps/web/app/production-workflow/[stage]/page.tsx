import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProductionLifecycleStage, productionLifecycleStages } from "@cacsms/contracts";
import { ProductionLifecycleWorkspace } from "@/features/production-lifecycle/ProductionLifecycleWorkspace";
import { getLifecycleStatus } from "@/lib/production-lifecycle-data";

export function generateStaticParams(){return productionLifecycleStages.map(stage=>({stage:stage.id}));}
export async function generateMetadata({params}:{params:Promise<{stage:string}>}):Promise<Metadata>{const {stage}=await params;const definition=getProductionLifecycleStage(stage);return definition?{title:`${definition.label} | Production Life Cycle | CACSMS`,description:definition.description}:{};}
export default async function ProductionLifecycleStagePage({params}:{params:Promise<{stage:string}>}){const {stage}=await params;const definition=getProductionLifecycleStage(stage);if(!definition)notFound();let initialStatus=null;try{initialStatus=await getLifecycleStatus();}catch(error){console.error("production-lifecycle.initial-status.failed",error);}return <ProductionLifecycleWorkspace stage={definition} initialStatus={initialStatus}/>;}

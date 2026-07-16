import { NextResponse } from "next/server";
import { getOperationalPage, isOperationalSlug, mutateOperationalPage } from "@/lib/opportunity-operations-data";
import type { OperationalMutation } from "@/types/opportunity-operations";
import {runAutonomousOpportunityPortfolioCycle} from "@/lib/autonomous-opportunity-portfolio-engine";
import {runAutonomousEditorialCycle} from "@/lib/autonomous-editorial-engine";
import {runAutonomousExecutiveRecommendationCycle} from "@/lib/autonomous-executive-recommendation-engine";
import {runAutonomousMultiFormatCycle} from "@/lib/autonomous-multi-format-planner-engine";
import {runAutonomousCampaignCycle} from "@/lib/autonomous-campaign-builder-engine";
import {runAutonomousEvergreenCycle} from "@/lib/autonomous-evergreen-knowledge-engine";
import {runAutonomousTemplateCycle} from "@/lib/autonomous-template-intelligence-engine";
import {runAutonomousOpportunityScheduler} from "@/lib/autonomous-opportunity-scheduler-engine";

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "The operational request failed.";
  return NextResponse.json({ message }, { status: /required|unsupported/i.test(message) ? 400 : 500 });
}

export async function GET(_: Request, context: { params: Promise<{ slug: string }> }) {
  try { const {slug}=await context.params; if(!isOperationalSlug(slug)) return NextResponse.json({message:"Page not found."},{status:404}); return NextResponse.json(await getOperationalPage(slug)); }
  catch(error){ console.error("opportunity.operations.failed", error); return errorResponse(error); }
}

export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  try { const {slug}=await context.params;if(slug==="opportunity-portfolio"||slug==="opportunity-scheduler"||slug==="editorial-board"||slug==="executive-recommendations"||slug==="multi-format-planner"||slug==="campaign-builder"||slug==="evergreen-knowledge-bank"||slug==="template-dashboard"){const token=process.env.CACSMS_INTERNAL_AUTONOMY_TOKEN;const internal=Boolean(token)&&request.headers.get("x-cacsms-internal")===token;if(!internal)return NextResponse.json({message:`${slug==="opportunity-scheduler"?"Opportunity scheduler":slug==="editorial-board"?"Editorial":slug==="executive-recommendations"?"Executive recommendation":slug==="multi-format-planner"?"Multi-format adaptation":slug==="campaign-builder"?"Campaign":slug==="evergreen-knowledge-bank"?"Evergreen knowledge":"Template"} lifecycle operations are scheduler-owned and accept no operator mutations.`},{status:403});if(slug==="opportunity-scheduler")await runAutonomousOpportunityScheduler("scheduler",true);else if(slug==="editorial-board")await runAutonomousEditorialCycle("scheduler",true);else if(slug==="executive-recommendations")await runAutonomousExecutiveRecommendationCycle("scheduler",true);else if(slug==="multi-format-planner")await runAutonomousMultiFormatCycle("scheduler",true);else if(slug==="campaign-builder")await runAutonomousCampaignCycle("scheduler",true);else if(slug==="evergreen-knowledge-bank")await runAutonomousEvergreenCycle("scheduler",true);else if(slug==="template-dashboard")await runAutonomousTemplateCycle("scheduler",true);else await runAutonomousOpportunityPortfolioCycle("scheduler",true);return NextResponse.json(await getOperationalPage(slug));} const body=await request.json() as OperationalMutation; await mutateOperationalPage(slug,body); return NextResponse.json(await getOperationalPage(slug)); }
  catch(error){ return errorResponse(error); }
}

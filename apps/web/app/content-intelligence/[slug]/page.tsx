import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ContentIntelligencePage } from "@/components/content-intelligence/ContentIntelligencePage";
import { IntelligenceReportsPage } from "@/components/content-intelligence/IntelligenceReportsPage";
import { CompetitorIntelligencePage } from "@/components/content-intelligence/CompetitorIntelligencePage";
import { CitationManagerPage } from "@/components/content-intelligence/CitationManagerPage";
import { CurriculumResearchPage, FactVerificationPage } from "@/components/content-intelligence/ResearchDedicatedPages";
import { ResearchWorkspacePage } from "@/components/content-intelligence/ResearchWorkspacePage";
import { AudienceResearchPage, SourceLibraryPage } from "@/components/content-intelligence/LibraryAudiencePages";
import { KnowledgeExtractionPage } from "@/components/content-intelligence/KnowledgeExtractionPage";
import { TrendIntelligencePage } from "@/components/content-intelligence/TrendIntelligencePage";
import { ContentGapAnalysisPage, KnowledgeBasePage } from "@/components/content-intelligence/GapKnowledgePages";
import { SourceAnalysisPage } from "@/components/content-intelligence/SourceAnalysisPage";
import { TopicDiscoveryPage } from "@/components/content-intelligence/TopicDiscoveryPage";
import { contentIntelligencePages } from "@/lib/content-intelligence-pages";
export const dynamic="force-dynamic";
export const revalidate=0;
export async function generateMetadata({params}:{params:Promise<{slug:string}>}):Promise<Metadata>{const {slug}=await params;const page=contentIntelligencePages[slug];return page?{title:`${page.title} | CACSMS`,description:page.subtitle}:{}}
export default async function ContentIntelligenceRoute({params}:{params:Promise<{slug:string}>}){const {slug}=await params;if(slug==="intelligence-reports")return <IntelligenceReportsPage/>;if(slug==="competitor-intelligence")return <CompetitorIntelligencePage/>;if(slug==="citation-manager")return <CitationManagerPage/>;if(slug==="fact-verification")return <FactVerificationPage/>;if(slug==="curriculum-research")return <CurriculumResearchPage/>;if(slug==="research-workspace")return <ResearchWorkspacePage/>;if(slug==="source-library")return <SourceLibraryPage/>;if(slug==="audience-research")return <AudienceResearchPage/>;if(slug==="knowledge-extraction")return <KnowledgeExtractionPage/>;if(slug==="trend-intelligence")return <TrendIntelligencePage/>;if(slug==="content-gap-analysis")return <ContentGapAnalysisPage/>;if(slug==="knowledge-base")return <KnowledgeBasePage/>;if(slug==="source-analysis")return <SourceAnalysisPage/>;if(slug==="topic-discovery")return <TopicDiscoveryPage/>;const page=contentIntelligencePages[slug];if(!page)notFound();return <ContentIntelligencePage page={page}/>}

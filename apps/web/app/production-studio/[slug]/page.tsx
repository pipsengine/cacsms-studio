import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CreateProductionPage } from "@/components/production-studio/CreateProductionPage";
import { ProductionCalendarPage } from "@/components/production-studio/ProductionCalendarPage";
import { ProductionListPage } from "@/components/production-studio/ProductionListPage";
import { ProductionPipelinePage } from "@/components/production-studio/ProductionPipelinePage";
import { AllProductionsPage } from "@/components/production-studio/AllProductionsPage";
import { productionPages, productionSlugs } from "@/lib/production-studio-pages";
export function generateStaticParams() { return productionSlugs.map((slug) => ({ slug })); }
export async function generateMetadata({params}:{params:Promise<{slug:string}>}):Promise<Metadata>{const {slug}=await params; const config=productionPages[slug]; const title=slug==="create-production"?"Create Production":slug==="production-pipeline"?"Production Pipeline":slug==="production-calendar"?"Production Calendar":config?.title;return title?{title:`${title} | CACSMS`,description:config?.description}:{}}
export default async function ProductionStudioRoute({params}:{params:Promise<{slug:string}>}){const {slug}=await params;if(slug==="create-production")return <CreateProductionPage/>;if(slug==="all-productions")return <AllProductionsPage/>;if(slug==="production-pipeline")return <ProductionPipelinePage/>;if(slug==="production-calendar")return <ProductionCalendarPage/>;const config=productionPages[slug];if(!config)notFound();return <ProductionListPage config={config}/>}

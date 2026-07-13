import type { Metadata } from "next";
import { ProductionListPage } from "@/components/production-studio/ProductionListPage";
import { productionPages } from "@/lib/production-studio-pages";
export const metadata: Metadata = { title: "Production Studio | CACSMS", description: productionPages.dashboard.description };
export default function ProductionStudioPage() { return <ProductionListPage config={productionPages.dashboard} />; }

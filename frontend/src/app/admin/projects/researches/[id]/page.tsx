import type { Metadata } from "next";
import { AdminResearchDetailRoute } from "@/components/routes/admin-research-detail-route";
import { placeholderParams } from "@/lib/static-route";

export const metadata: Metadata = { title: "연구 등록 상세", robots: { index: false, follow: false } };

export function generateStaticParams() {
  return placeholderParams("id");
}

export default function ResearchDetailPage() {
  return <AdminResearchDetailRoute />;
}

import type { Metadata } from "next";
import { ResearchDetailScreen } from "@/components/admin/operations-research";

export const metadata: Metadata = { title: "연구 등록 상세", robots: { index: false, follow: false } };

export default async function ResearchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ResearchDetailScreen researchId={id} />;
}

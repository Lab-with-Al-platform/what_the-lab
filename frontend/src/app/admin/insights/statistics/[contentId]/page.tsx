import type { Metadata } from "next";
import { InsightStatisticDetail } from "@/components/admin/insight-statistics";

export const metadata: Metadata = { title: "인사이트 글별 통계", robots: { index: false, follow: false } };

export default async function InsightStatisticPage({ params }: { params: Promise<{ contentId: string }> }) {
  const { contentId } = await params;
  return <InsightStatisticDetail contentId={contentId} />;
}

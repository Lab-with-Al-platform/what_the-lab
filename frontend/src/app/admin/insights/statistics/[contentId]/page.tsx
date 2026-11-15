import type { Metadata } from "next";
import { AdminInsightStatisticRoute } from "@/components/routes/admin-insight-statistic-route";
import { placeholderParams } from "@/lib/static-route";

export const metadata: Metadata = { title: "인사이트 글별 통계", robots: { index: false, follow: false } };

export function generateStaticParams() {
  return placeholderParams("contentId");
}

export default function InsightStatisticPage() {
  return <AdminInsightStatisticRoute />;
}

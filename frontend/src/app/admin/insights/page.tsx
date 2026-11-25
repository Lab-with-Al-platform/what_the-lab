import type { Metadata } from "next";
import { InsightAdminWorkspace } from "@/components/admin/insight-workspace";

export const metadata: Metadata = {
  title: "인사이트 관리자",
  robots: { index: false, follow: false },
};

export default function InsightAdminPage() {
  return <InsightAdminWorkspace />;
}

import type { Metadata } from "next";
import { Suspense } from "react";
import { OperationsAnalyticsScreen } from "@/components/admin/operations-analytics";
import styles from "@/components/admin/admin-workspace.module.css";

export const metadata: Metadata = { title: "방문 통계", robots: { index: false, follow: false } };

export default function AnalyticsPage() {
  return (
    <Suspense fallback={<div className={styles.pageFallback} role="status">방문 통계를 준비하는 중…</div>}>
      <OperationsAnalyticsScreen />
    </Suspense>
  );
}

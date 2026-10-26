import type { Metadata } from "next";
import { Suspense } from "react";
import { OperationsSummaryScreen } from "@/components/admin/operations-summary";
import styles from "@/components/admin/admin-workspace.module.css";

export const metadata: Metadata = { title: "운영 요약", robots: { index: false, follow: false } };

export default function AdminHomePage() {
  return (
    <Suspense fallback={<div className={styles.pageFallback} role="status">운영 요약을 준비하는 중…</div>}>
      <OperationsSummaryScreen />
    </Suspense>
  );
}

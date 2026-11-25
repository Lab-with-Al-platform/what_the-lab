import type { Metadata } from "next";
import { Suspense } from "react";
import { MembersScreen } from "@/components/admin/operations-members";
import styles from "@/components/admin/admin-workspace.module.css";

export const metadata: Metadata = { title: "회원 관리", robots: { index: false, follow: false } };

export default function MembersPage() {
  return (
    <Suspense fallback={<div className={styles.pageFallback} role="status">회원 목록을 준비하는 중…</div>}>
      <MembersScreen />
    </Suspense>
  );
}

import type { Metadata } from "next";
import { Suspense } from "react";
import { ProjectsScreen } from "@/components/admin/operations-research";
import styles from "@/components/admin/admin-workspace.module.css";

export const metadata: Metadata = { title: "연구 등록", robots: { index: false, follow: false } };

export default function ProjectsPage() {
  return (
    <Suspense fallback={<div className={styles.pageFallback} role="status">연구 등록을 준비하는 중…</div>}>
      <ProjectsScreen />
    </Suspense>
  );
}

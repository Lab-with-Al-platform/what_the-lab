import type { Metadata } from "next";
import { Suspense } from "react";
import { ExpertBrowser } from "@/components/expert-browser";
import { PageContainer } from "@/components/page-container";
import { expertDomains, expertTasks, listExperts } from "@/lib/experts";

export const metadata: Metadata = {
  title: "AI 전문가 찾기",
};

export default function ExpertsPage() {
  return (
    <Suspense fallback={<PageContainer className="py-16 text-sm text-muted">전문가 목록을 준비하는 중입니다.</PageContainer>}>
      <ExpertBrowser experts={listExperts()} tasks={expertTasks()} domains={expertDomains()} />
    </Suspense>
  );
}

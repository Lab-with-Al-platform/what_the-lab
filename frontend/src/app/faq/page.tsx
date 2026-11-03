import { Suspense } from "react";
import { FaqPage } from "@/components/community/faq-page";

export const metadata = {
  title: "자주 묻는 질문",
  description: "연구·전문가 탐색, 직접 협업 요청, 공유 일정·작업 관리, Google Calendar, 협업 평가와 게시판 이용 가이드",
};
export default function FaqRoute() {
  return (
    <Suspense
      fallback={<p className="p-8 text-muted">도움말을 준비하고 있어요…</p>}
    >
      <FaqPage />
    </Suspense>
  );
}

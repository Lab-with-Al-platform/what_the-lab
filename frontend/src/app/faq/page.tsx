import { Suspense } from "react";
import { FaqPage } from "@/components/community/faq-page";

export const metadata = {
  title: "자주 묻는 질문",
  description: "시작하기, 계정, 연구·전문가 탐색, 공개·비공개 게시판 도움말",
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

import { Suspense } from "react";
import { CommunityBoard } from "@/components/community/community-board";

export const metadata = {
  title: "자유게시판",
  description:
    "연구 질문과 개발 경험, 서비스 피드백을 나누는 랩브릿지 자유게시판",
};
export default function CommunityPage() {
  return (
    <Suspense
      fallback={<p className="p-8 text-muted">게시판을 준비하고 있어요…</p>}
    >
      <CommunityBoard />
    </Suspense>
  );
}

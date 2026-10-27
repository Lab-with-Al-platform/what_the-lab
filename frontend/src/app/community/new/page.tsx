import { Suspense } from "react";
import { CommunityComposer } from "@/components/community/community-composer";

export const metadata = {
  title: "글쓰기",
  robots: { index: false, follow: false },
};
export default function NewCommunityPost() {
  return (
    <Suspense
      fallback={<p className="p-8 text-muted">글쓰기를 준비하고 있어요…</p>}
    >
      <CommunityComposer />
    </Suspense>
  );
}

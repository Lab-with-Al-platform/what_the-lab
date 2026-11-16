import { Suspense } from "react";
import { CommunityEditRoute } from "@/components/routes/community-edit-route";
import { placeholderParams } from "@/lib/static-route";

export const metadata = {
  title: "글 수정",
  robots: { index: false, follow: false },
};

export function generateStaticParams() {
  return placeholderParams("id");
}

export default function EditCommunityPost() {
  return (
    <Suspense
      fallback={<p className="p-8 text-muted">글을 불러오고 있어요…</p>}
    >
      <CommunityEditRoute />
    </Suspense>
  );
}

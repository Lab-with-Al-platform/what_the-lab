import { Suspense } from "react";
import { CommunityComposer } from "@/components/community/community-composer";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "글 수정",
  robots: { index: false, follow: false },
};
export default async function EditCommunityPost({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Suspense
      fallback={<p className="p-8 text-muted">글을 불러오고 있어요…</p>}
    >
      <CommunityComposer postId={id} />
    </Suspense>
  );
}

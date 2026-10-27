import { CommunityDetail } from "@/components/community/community-detail";

// 공용 HTML·메타데이터에 비공개 제목·본문을 넣지 않습니다.
export const dynamic = "force-dynamic";
export const metadata = {
  title: "게시글",
  robots: { index: false, follow: false },
};
export default async function CommunityPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CommunityDetail postId={id} />;
}

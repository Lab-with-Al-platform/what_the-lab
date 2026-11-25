import { CommunityDetailRoute } from "@/components/routes/community-detail-route";
import { placeholderParams } from "@/lib/static-route";

// 공용 HTML·메타데이터에 비공개 제목·본문을 넣지 않습니다. 글은 브라우저에서 권한 확인 뒤 불러와요.
export const metadata = {
  title: "게시글",
  robots: { index: false, follow: false },
};

export function generateStaticParams() {
  return placeholderParams("id");
}

export default function CommunityPostPage() {
  return <CommunityDetailRoute />;
}

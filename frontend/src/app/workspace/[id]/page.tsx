import { WorkspaceDetailRoute } from "@/components/routes/workspace-detail-route";
import { placeholderParams } from "@/lib/static-route";

// 정적 빌드는 /workspace/0 빈 화면 하나만 만들고, 실제 번호(/workspace/4)는 브라우저 주소에서 읽어요.
export function generateStaticParams() {
  return placeholderParams("id");
}

// 협업 상세: 협업 공간 목록에서 협업 하나를 누르면 오는 곳
export default function Page() {
  return <WorkspaceDetailRoute />;
}

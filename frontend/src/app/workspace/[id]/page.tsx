import { WorkspaceDetailPage } from "@/components/workspace-detail-page";

interface PageProps {
  params: Promise<{ id: string }>; // 주소의 [id] 부분 (예: /workspace/4 → "4")
}

// 협업 상세: 협업 공간 목록에서 협업 하나를 누르면 오는 곳
export default async function Page({ params }: PageProps) {
  const { id } = await params;
  return <WorkspaceDetailPage collaborationId={Number(id)} />;
}
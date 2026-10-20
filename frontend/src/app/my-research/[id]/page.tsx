import { MyResearchDetail } from "@/components/my-research-detail";
import { MySpaceShell } from "@/components/my-space-shell";

interface PageProps {
  params: Promise<{ id: string }>; // 주소의 [id] 부분 (예: /my-research/12 → "12")
}

export default async function MyResearchDetailPage({ params }: PageProps) {
  const { id } = await params;
  return (
    <MySpaceShell role="researcher">
      <MyResearchDetail researchId={Number(id)} />
    </MySpaceShell>
  );
}
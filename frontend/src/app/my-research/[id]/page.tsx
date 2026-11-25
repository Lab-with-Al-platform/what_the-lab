import { MyResearchDetailRoute } from "@/components/routes/my-research-detail-route";
import { MySpaceShell } from "@/components/my-space-shell";
import { placeholderParams } from "@/lib/static-route";

// 주소의 [id] 부분(예: /my-research/12 → "12")은 브라우저 주소에서 읽어요.
export function generateStaticParams() {
  return placeholderParams("id");
}

export default function MyResearchDetailPage() {
  return (
    <MySpaceShell role="researcher">
      <MyResearchDetailRoute />
    </MySpaceShell>
  );
}

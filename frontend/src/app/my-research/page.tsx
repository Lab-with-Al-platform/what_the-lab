import { MyResearchList } from "@/components/my-research-list";
import { MySpaceShell } from "@/components/my-space-shell";

export default function MyResearchPage() {
  return (
    <MySpaceShell role="researcher">
      <MyResearchList />
    </MySpaceShell>
  );
}
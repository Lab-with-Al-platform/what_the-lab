import type { Metadata } from "next";
import { MyCareerProfile } from "@/components/my-career-profile";
import { MySpaceShell } from "@/components/my-space-shell";

export const metadata: Metadata = { title: "내 이력" };

export default function MyCareerPage() {
  return (
    <MySpaceShell role="expert">
      <MyCareerProfile />
    </MySpaceShell>
  );
}
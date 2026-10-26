import type { Metadata } from "next";
import { MemberDetailScreen } from "@/components/admin/operations-members";

export const metadata: Metadata = { title: "회원 상세", robots: { index: false, follow: false } };

export default async function MemberDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <MemberDetailScreen userId={id} />;
}

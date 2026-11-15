import type { Metadata } from "next";
import { AdminMemberDetailRoute } from "@/components/routes/admin-member-detail-route";
import { placeholderParams } from "@/lib/static-route";

export const metadata: Metadata = { title: "회원 상세", robots: { index: false, follow: false } };

export function generateStaticParams() {
  return placeholderParams("id");
}

export default function MemberDetailPage() {
  return <AdminMemberDetailRoute />;
}

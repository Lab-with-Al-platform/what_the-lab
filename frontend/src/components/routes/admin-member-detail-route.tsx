"use client";

// /admin/members/{회원 번호} 입구: 번호를 브라우저 주소에서 읽어 기존 화면에 넘겨요 (정적 빌드, lib/route-segment.ts).
// key={번호}: 다른 번호로 이동하면 화면 상태(불러온 데이터 등)를 새로 시작해요.
import { MemberDetailScreen } from "@/components/admin/operations-members";
import { RouteLoading } from "@/components/routes/route-loading";
import { usePathSegment } from "@/lib/route-segment";

/** /admin/members/{회원 번호} */
export function AdminMemberDetailRoute() {
  const id = usePathSegment(2);
  if (!id) return <RouteLoading />;
  return <MemberDetailScreen key={id} userId={id} />;
}

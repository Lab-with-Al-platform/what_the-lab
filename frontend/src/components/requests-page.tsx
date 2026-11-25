"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ApiError, requestApi } from "@/lib/api";
import { MySpaceShell } from "@/components/my-space-shell";
import { ReceivedRequests } from "@/components/received-requests";
import { SentRequests } from "@/components/sent-requests";

type Me = { user_role: "researcher" | "expert" | null };

/** /requests(요청관리) 한 주소에서 연구회원은 보낸 요청, AI 전문가는 받은 요청을 보여 줘요. */
export function RequestsPage() {
  const [role, setRole] = useState<Me["user_role"] | undefined>(undefined); // undefined = 아직 확인 중
  const [error, setError] = useState("");

  useEffect(() => {
    requestApi<Me>("/auth/me")
      .then((me) => setRole(me.user_role))
      .catch((caught) => setError(caught instanceof ApiError ? caught.message : "잠시 후 다시 시도해 주세요"));
  }, []);

  if (error) return <Notice text={error} href="/login" action="로그인하러 가기" />;
  if (role === undefined) return <p className="py-20 text-center text-sm text-faint">불러오는 중…</p>;
  if (role === null) return <Notice text="회원 유형을 먼저 골라 주세요" href="/signup" action="가입 이어서 하기" />;

  return <MySpaceShell role={role}>{role === "researcher" ? <SentRequests /> : <ReceivedRequests />}</MySpaceShell>;
}

function Notice({ text, href, action }: { text: string; href: string; action: string }) {
  return (
    <div className="py-20 text-center">
      <p className="text-sm text-muted">{text}</p>
      <Link href={href} className="mt-4 inline-flex h-10 items-center rounded-button bg-brand px-4 text-sm font-semibold text-white">
        {action}
      </Link>
    </div>
  );
}
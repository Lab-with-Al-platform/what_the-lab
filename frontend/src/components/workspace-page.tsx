"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ApiError, requestApi } from "@/lib/api";
import { MySpaceShell } from "@/components/my-space-shell";
import { WorkspaceHome } from "@/components/workspace-home";

type Me = { user_role: "researcher" | "expert" | null; nickname: string };

/** /workspace 한 주소에서 연구회원·AI 전문가 모두 자기 협업을 봐요. (상대방만 다르게 보여요) */
export function WorkspacePage() {
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    requestApi<Me>("/auth/me")
      .then(setMe)
      .catch((caught) => setError(caught instanceof ApiError ? caught.message : "잠시 후 다시 시도해 주세요"));
  }, []);

  if (error) return <Notice text={error} href="/login" action="로그인하러 가기" />;
  if (!me) return <p className="py-20 text-center text-sm text-faint">불러오는 중…</p>;
  if (!me.user_role) return <Notice text="회원 유형을 먼저 골라 주세요" href="/signup" action="가입 이어서 하기" />;

  return (
    <MySpaceShell role={me.user_role}>
      <WorkspaceHome role={me.user_role} />
    </MySpaceShell>
  );
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
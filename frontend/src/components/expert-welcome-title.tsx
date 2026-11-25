"use client";

import { useEffect, useState } from "react";
import { requestApi } from "@/lib/api";

// 전문가 가입 완료 화면의 제목: 로그인한 사람의 디스코드 활동명을 넣어 보여 줍니다.
export function ExpertWelcomeTitle() {
  const [nickname, setNickname] = useState<string | null>(null);

  useEffect(() => {
    requestApi<{ nickname: string }>("/auth/me")
      .then((me) => setNickname(me.nickname))
      .catch(() => setNickname(null)); // 못 불러와도 제목은 이름 없이 보여 줍니다.
  }, []);

  return <h1 className="text-2xl font-bold">가입을 환영해요{nickname ? `, ${nickname} 님` : ""}!</h1>;
}
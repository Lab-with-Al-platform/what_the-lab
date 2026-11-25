import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginFromUrl, LoginPanel } from "@/components/login-panel";

export const metadata: Metadata = { title: "로그인" };

// 미리 만든 HTML에는 기본 로그인 카드가 들어가고, ?error= 는 브라우저에서 확인해요.
export default function LoginPage() {
  return (
    <Suspense fallback={<LoginPanel hasError={false} />}>
      <LoginFromUrl />
    </Suspense>
  );
}

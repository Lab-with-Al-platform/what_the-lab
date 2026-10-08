import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "로그인" };

export default function LoginPage() {
  return (
    <section className="mx-auto max-w-xl px-4 py-16 md:px-6">
      <h1 className="text-3xl font-bold">로그인</h1>
      <p className="mt-4 text-sm leading-7 text-muted">
        계정 화면은 이번 공개 페이지 작업에 포함하지 않았습니다. 버튼 자리만 헤더에 연결되어 있습니다.
      </p>
      <Link href="/" className="mt-8 inline-flex text-sm font-semibold text-brand">
        홈으로 →
      </Link>
    </section>
  );
}

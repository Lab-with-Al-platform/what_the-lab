import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "회원가입" };

export default function SignupPage() {
  return (
    <section className="mx-auto max-w-xl px-4 py-16 md:px-6">
      <h1 className="text-3xl font-bold">회원가입</h1>
      <p className="mt-4 text-sm leading-7 text-muted">
        가입 화면은 이번 공개 페이지 작업에 포함하지 않았습니다. 연구자·전문가 역할 선택은 다음 화면에서 다룹니다.
      </p>
      <Link href="/" className="mt-8 inline-flex text-sm font-semibold text-brand">
        홈으로 →
      </Link>
    </section>
  );
}

import Link from "next/link";

export default function NotFound() {
  return (
    <section className="mx-auto max-w-xl px-4 py-16 md:px-6">
      <h1 className="text-3xl font-bold">페이지를 찾을 수 없습니다</h1>
      <p className="mt-4 text-sm leading-7 text-muted">주소가 바뀌었거나, 아직 없는 화면일 수 있습니다.</p>
      <Link href="/" className="mt-8 inline-flex text-sm font-semibold text-brand">
        홈으로 →
      </Link>
    </section>
  );
}

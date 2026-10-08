import Link from "next/link";
import { PageContainer } from "@/components/page-container";

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-line bg-white">
      <PageContainer className="flex flex-col gap-6 py-10 text-sm text-muted md:flex-row md:items-end md:justify-between">
        <div>
          <p className="font-semibold text-ink">LabBridge</p>
          <p className="mt-1 max-w-md">연구의 질문과 AI 전문가가 만나는 협업 플랫폼의 공개 화면 시안입니다.</p>
        </div>
        <nav className="flex flex-wrap gap-4" aria-label="바닥 메뉴">
          <Link href="/cases" className="hover:text-ink">
            AI 연구 협업 사례
          </Link>
          <Link href="/trends" className="hover:text-ink">
            AI 트렌드
          </Link>
          <Link href="/experts" className="hover:text-ink">
            AI 전문가 찾기
          </Link>
        </nav>
      </PageContainer>
    </footer>
  );
}

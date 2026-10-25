"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

// 왼쪽 "내 공간" 메뉴. 회원 유형마다 다릅니다. (주소는 헤더 드롭다운과 같게 맞춤)
const MENUS = {
  researcher: [
    { href: "/requests", label: "요청관리" },
    { href: "/workspace", label: "협업 공간" },
    { href: "/my-research", label: "내 연구" },
    { href: "/settings/profile", label: "프로필 설정" },
  ],
  expert: [
    { href: "/requests", label: "요청관리" },
    { href: "/workspace", label: "내 협업" },
    { href: "/my-career", label: "내 이력" },
    { href: "/settings/profile", label: "프로필 설정" },
  ],
};

const NOTICE = {
  researcher: "작성한 연구는 나만 볼 수 있어요. 요청을 보내면 그 전문가에게만 전달돼요.",
  expert: "요청이 오면 디스코드 DM으로도 알려 드려요.",
};

interface MySpaceShellProps {
  role: "researcher" | "expert";
  children: ReactNode;
}

/** 내 연구·내 이력 등 "내 공간" 화면의 공통 틀: 왼쪽 메뉴 + 오른쪽 본문 */
export function MySpaceShell({ role, children }: MySpaceShellProps) {
  const pathname = usePathname();

  return (
    <div className="mx-auto flex max-w-[var(--layout-content)] border-line lg:border-x">
      <aside className="hidden w-60 shrink-0 border-r border-line px-4 py-6 lg:block">
        <p className="px-3 text-xs font-semibold text-faint">내 공간</p>
        <nav className="mt-2 grid gap-1" aria-label="내 공간 메뉴">
          {MENUS[role].map((item) => {
            const current = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={current ? "page" : undefined}
                className={`flex h-[42px] items-center rounded-button px-3 text-sm ${
                  current ? "bg-brand-soft font-semibold text-brand" : "text-muted hover:bg-page"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <p className="mt-5 border-t border-line px-3 pt-5 text-xs leading-5 text-faint">{NOTICE[role]}</p>
      </aside>
      <div className="min-w-0 flex-1 px-4 py-8 md:px-10">{children}</div>
    </div>
  );
}
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { PageContainer } from "@/components/page-container";

const NAV_ITEMS = [
  { href: "/", label: "홈" },
  { href: "/cases", label: "AI 연구 협업 사례" },
  { href: "/trends", label: "AI 트렌드" },
  { href: "/experts", label: "AI 전문가 찾기" },
];

function isCurrent(pathname: string, href: string): boolean {
  if (href === "/") {
    return pathname === "/";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteHeader() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") {
        return;
      }
      setMenuOpen(false);
      setSearchOpen(false);
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-white/95 backdrop-blur">
      <PageContainer className="flex h-[var(--header-height)] items-center gap-6">
        <Link href="/" className="flex items-center gap-2.5 text-[20px] font-bold tracking-tight text-ink">
          <span className="relative h-8 w-8 overflow-hidden rounded-[8px] bg-[linear-gradient(135deg,#243e96_0%,#6d4dc4_48%,#ff7b42_100%)] shadow-[0_3px_10px_rgb(31_45_91_/_0.16)]" aria-hidden="true">
            <span className="absolute top-[7px] right-[7px] h-1.5 w-1.5 rounded-full bg-white" />
          </span>
          LabBridge
        </Link>

        <nav className="hidden items-center gap-8 text-sm text-ink lg:flex" aria-label="주요 메뉴">
          {NAV_ITEMS.map((item) => {
            const current = isCurrent(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={current ? "page" : undefined}
                className={`flex h-[var(--header-height)] items-center border-b-2 ${
                  current
                    ? "border-brand font-semibold text-brand"
                    : "border-transparent hover:text-brand"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            className="grid h-11 w-11 place-items-center rounded-button text-ink hover:bg-page"
            aria-expanded={searchOpen}
            aria-controls="header-search"
            onClick={() => setSearchOpen((open) => !open)}
          >
            <span className="sr-only">인사이트 검색 열기</span>
            <SearchIcon />
          </button>
          
          <Link
            href="/login"
            className="hidden h-11 items-center rounded-button bg-ink px-4 text-sm font-semibold text-white hover:bg-brand-hover sm:inline-flex"
          >
            디스코드로 로그인
          </Link>
          <button
            type="button"
            className="grid h-11 w-11 place-items-center rounded-button hover:bg-page lg:hidden"
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span className="sr-only">메뉴</span>
            <MenuIcon />
          </button>
        </div>
      </PageContainer>

      {searchOpen ? (
        <form id="header-search" action="/search" className="border-t border-line bg-white">
          <PageContainer className="flex gap-2 py-3">
            <label className="sr-only" htmlFor="site-search">
              제목, 분야, 태그로 검색
            </label>
            <input
              id="site-search"
              name="q"
              placeholder="사례와 트렌드 검색"
              className="h-11 flex-1 rounded-button border border-line px-4 text-sm"
              autoFocus
            />
            <button type="submit" className="h-11 rounded-button bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-hover">
              검색
            </button>
          </PageContainer>
        </form>
      ) : null}

      {menuOpen ? (
        <nav id="mobile-nav" className="border-t border-line bg-white py-3 lg:hidden" aria-label="모바일 메뉴">
          <PageContainer>
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex min-h-11 items-center rounded-button px-3 text-sm font-medium hover:bg-page"
              onClick={() => setMenuOpen(false)}
            >
              {item.label}
            </Link>
          ))}
          <div className="mt-2 grid grid-cols-2 gap-2 sm:hidden">
            
            <Link href="/login" className="flex min-h-11 items-center justify-center rounded-button bg-ink text-sm font-semibold text-white">
              디스코드로 로그인
            </Link>
          </div>
          </PageContainer>
        </nav>
      ) : null}
    </header>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="11" cy="11" r="6" />
      <path d="M16 16l4 4" strokeLinecap="round" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M5 7h14M5 12h14M5 17h14" strokeLinecap="round" />
    </svg>
  );
}

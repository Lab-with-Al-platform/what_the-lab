"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BrandMark } from "@/components/brand-mark";
import { BrandWordmark } from "@/components/brand-wordmark";
import { NotificationBell } from "@/components/notification-bell";
import { PageContainer } from "@/components/page-container";
import { apiAsset, requestApi } from "@/lib/api";
import { adminHomeHref } from "@/lib/admin-nav";
import { ME_CHANGED_EVENT } from "@/lib/profile-settings";

const NAV_ITEMS = [
  { href: "/", label: "홈" },
  { href: "/cases", label: "AI 연구 협업 사례" },
  { href: "/trends", label: "AI 트렌드" },
  { href: "/experts", label: "AI 전문가 찾기" },
  { href: "/community", label: "자유게시판" },
  { href: "/faq", label: "FAQ" },
];

type Me = {
  nickname: string;
  user_role: "researcher" | "expert" | null;
  user_photo: string | null;
  signup_step: string;
  can_manage_insights?: boolean;
  can_read_operations?: boolean;
};

// 프로필 드롭다운 메뉴 (주소는 임시, 페이지 만들 때 팀과 맞추기)
const RESEARCHER_MENU = [
  { href: "/requests", label: "요청관리" },
  { href: "/workspace", label: "협업공간" },
  { href: "/my-research", label: "내 연구" },
  { href: "/settings/profile", label: "프로필 설정" },
];

const EXPERT_MENU = [
  { href: "/requests", label: "요청관리" },
  { href: "/workspace", label: "협업공간" },
  { href: "/my-career", label: "내 이력" },
  { href: "/settings/profile", label: "프로필 설정" },
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
  const [me, setMe] = useState<Me | null>(null);
  const [meLoading, setMeLoading] = useState(true);
  const [profileOpen, setProfileOpen] = useState(false);
  const [canManageInsights, setCanManageInsights] = useState(false);
  const [canReadOperations, setCanReadOperations] = useState(false);
  const adminHome = adminHomeHref(canReadOperations, canManageInsights);
  const [meVersion, setMeVersion] = useState(0); // 프로필 설정에서 사진을 바꾸면 1씩 올라가요 → 내 정보를 다시 불러와요
  const profileRef = useRef<HTMLDivElement>(null);
  const meRef = useRef(me);
  meRef.current = me;

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") {
        return;
      }
      setMenuOpen(false);
      setSearchOpen(false);
      setProfileOpen(false);
      if (profileRef.current?.contains(document.activeElement)) {
        profileRef.current.querySelector("button")?.focus();
      }
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);

  // 로그인한 사람 정보 불러오기 (401이면 비로그인)
  // 페이지를 옮길 때마다 치지 않습니다. 사진 변경·가입 중인 주소 이동만 다시 받습니다.
  useEffect(() => {
    let active = true;
    requestApi<Me>("/auth/me")
      .then((user) => {
        if (!active) return;
        setMe(user);
        setCanManageInsights(user.can_manage_insights === true);
        setCanReadOperations(user.can_read_operations === true);
      })
      .catch(() => {
        if (!active) return;
        setMe(null);
        setCanManageInsights(false);
        setCanReadOperations(false);
      })
      .finally(() => { if (active) setMeLoading(false); });
    return () => { active = false; };
  }, [meVersion]);

  // 가입이 끝나기 전에는 화면을 옮길 때 한 번 더 확인합니다. (완료 후 홈에서 메뉴가 바뀌게)
  useEffect(() => {
    if (meRef.current && meRef.current.signup_step !== "done") {
      setMeVersion((version) => version + 1);
    }
  }, [pathname]);

  // 프로필 설정에서 사진을 바꿨다는 신호를 받으면 내 정보를 다시 불러와요.
  useEffect(() => {
    const reload = () => setMeVersion((version) => version + 1);
    window.addEventListener(ME_CHANGED_EVENT, reload);
    return () => window.removeEventListener(ME_CHANGED_EVENT, reload);
  }, []);

  // 드롭다운이 열려 있을 때, 프로필 영역 바깥을 누르면 닫기
  useEffect(() => {
    if (!profileOpen) return;

    function closeOnOutsideClick(event: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setProfileOpen(false);
      }
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, [profileOpen]);


  // 로그아웃: 백엔드가 쿠키를 지우고, 홈으로 새로 불러오기
  async function logout() {
    await requestApi("/auth/logout", { method: "POST" });
    window.location.href = "/";
  }

  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-white/95 backdrop-blur">
      <PageContainer className="flex h-[var(--header-height)] items-center gap-6">
        <Link href="/" className="flex items-center gap-2" aria-label="LabBridge">
          <BrandMark priority />
          <BrandWordmark height={28} priority alt="" />
        </Link>

        <nav className="hidden items-center gap-5 whitespace-nowrap text-sm text-ink xl:flex" aria-label="주요 메뉴">
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

          {me && me.signup_step === "done" ? <NotificationBell pathname={pathname} /> : null}

          {meLoading ? null : !me ? (
            <Link
              href="/login"
              className="hidden h-11 items-center rounded-button bg-ink px-4 text-sm font-semibold text-white hover:bg-brand-hover sm:inline-flex"
            >
              디스코드로 로그인
            </Link>
          ) : me.signup_step !== "done" && !canManageInsights ? (
            <Link
              href="/signup"
              className="hidden h-11 items-center rounded-button bg-ink px-4 text-sm font-semibold text-white hover:bg-brand-hover sm:inline-flex"
            >
              가입 이어하기
            </Link>
          ) : (
            <div ref={profileRef} className="relative">
              <button
                type="button"
                className="inline-flex h-11 items-center gap-2 rounded-button px-2 text-sm font-semibold text-ink hover:bg-page"
                aria-expanded={profileOpen}
                aria-label="계정 메뉴"
                aria-controls="account-navigation"
                onClick={() => setProfileOpen((open) => !open)}
              >
                <ProfilePhoto me={me} />
                <span className="hidden sm:inline">{me.nickname}</span>
              </button>

              {profileOpen ? (
                <nav id="account-navigation" aria-label="계정 메뉴" className="absolute right-0 top-full mt-2 w-52 rounded-button border border-line bg-white py-2 shadow-card">
                  {(me.signup_step !== "done" ? [{ href: "/signup", label: "가입 이어하기" }]
                    : me.user_role === "expert" ? EXPERT_MENU : RESEARCHER_MENU).map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="flex min-h-10 items-center px-4 text-sm hover:bg-page"
                      onClick={() => setProfileOpen(false)}
                    >
                      {item.label}
                    </Link>
                  ))}

                  {adminHome ? (
                    <Link href={adminHome} className="flex min-h-11 items-center px-4 text-sm font-semibold text-brand hover:bg-brand-soft" onClick={() => setProfileOpen(false)}>
                      관리자
                    </Link>
                  ) : null}

                  <div className="my-2 border-t border-line" />
                  <button
                    type="button"
                    className="flex min-h-10 w-full items-center px-4 text-sm text-ink hover:bg-page"
                    onClick={logout}
                  >
                    로그아웃
                  </button>
                </nav>
              ) : null}
            </div>
          )}

          <button
            type="button"
            className="grid h-11 w-11 place-items-center rounded-button hover:bg-page xl:hidden"
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
        <nav id="mobile-nav" className="border-t border-line bg-white py-3 xl:hidden" aria-label="모바일 메뉴">
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
          <div className="mt-2 grid gap-1 border-t border-line pt-3 sm:hidden">
            {meLoading ? null : !me ? (
              <Link href="/login" className="flex min-h-11 items-center justify-center rounded-button bg-ink text-sm font-semibold text-white">
                디스코드로 로그인
              </Link>
            ) : me.signup_step !== "done" ? (
              <Link href="/signup" className="flex min-h-11 items-center justify-center rounded-button bg-ink text-sm font-semibold text-white">
                가입 이어하기
              </Link>
            ) : (
              <>
                <div className="flex items-center gap-2 px-3 py-2">
                  <ProfilePhoto me={me} />
                  <span className="text-sm font-semibold text-ink">{me.nickname}</span>
                </div>
                {(me.user_role === "expert" ? EXPERT_MENU : RESEARCHER_MENU).map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex min-h-11 items-center rounded-button px-3 text-sm font-medium hover:bg-page"
                    onClick={() => setMenuOpen(false)}
                  >
                    {item.label}
                  </Link>
                ))}
                {adminHome ? (
                  <Link href={adminHome} className="flex min-h-11 items-center rounded-button px-3 text-sm font-semibold text-brand hover:bg-brand-soft" onClick={() => setMenuOpen(false)}>
                    관리자
                  </Link>
                ) : null}
                <button
                  type="button"
                  className="flex min-h-11 w-full items-center rounded-button px-3 text-sm font-medium hover:bg-page"
                  onClick={logout}
                >
                  로그아웃
                </button>
              </>
            )}
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

function ProfilePhoto({ me }: { me: Me }) {
  const className = "h-8 w-8 rounded-full object-cover";
  if (me.user_photo) {
    // 올린 사진은 백엔드 주소라 이번 범위에서 next/image 원격 설정을 넣지 않습니다.
    // eslint-disable-next-line @next/next/no-img-element -- 사용자 사진은 API 주소입니다.
    return <img src={apiAsset(me.user_photo)} alt="" className={className} />;
  }
  const src = me.user_role === "expert"
    ? "/profile-images/default-expert.png"
    : "/profile-images/default-researcher.png";
  return <Image src={src} alt="" width={32} height={32} sizes="32px" className={className} />;
}

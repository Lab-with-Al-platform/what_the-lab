"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createContext, ReactNode, Suspense, useContext, useEffect, useState } from "react";
import { PageContainer } from "@/components/page-container";
import { ApiError, requestApi } from "@/lib/api";
import { ADMIN_MENU, adminFallbackPath, permittedAdminMenu } from "@/lib/admin-nav";
import styles from "./admin-workspace.module.css";

export type AdminIconName = "overview" | "members" | "research" | "insights" | "lock" | "arrow" | "chart";
const PATHS: Record<AdminIconName, string> = {
  overview: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
  members: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M16 3a4 4 0 0 1 0 8 M22 21v-2a4 4 0 0 0-3-3.87 M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
  research: "M9 3h6 M10 3v7L4 19a1 1 0 0 0 1 2h14a1 1 0 0 0 1-2l-6-9V3 M8 15h8",
  insights: "M4 3h12l4 4v14H4z M14 3v6h6 M8 13h8 M8 17h5",
  lock: "M5 11h14v10H5z M8 11V7a4 4 0 0 1 8 0v4",
  arrow: "M5 12h14 M13 6l6 6-6 6",
  chart: "M3 3v18h18 M7 14l4-5 4 3 5-7",
};

export function AdminIcon({ name, size = 18 }: { name: AdminIconName; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={PATHS[name]} /></svg>;
}

const PreviewContext = createContext(false);
export const useAdminDemo = () => useContext(PreviewContext);

const ChromeContext = createContext<{ showMode: boolean; demo: boolean; setDemo: (value: boolean) => void }>({ showMode: false, demo: false, setDemo: () => undefined });
/** 실데이터·데모 전환은 탭 줄 또는 제목 옆에서 그립니다. */
export const useAdminChrome = () => useContext(ChromeContext);

/** 데모 여부만 주소에 붙입니다. 권한이나 서버 데이터를 바꾸지 않습니다. */
export function adminHref(href: string, demo: boolean): string {
  if (!demo || href.startsWith("/admin/insights")) return href;
  return `${href}${href.includes("?") ? "&" : "?"}demo=1`;
}

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  // 원고 iframe에는 공통 메뉴를 넣지 않아 기존 본문 미리보기 폭을 보존합니다.
  if (pathname === "/admin/insights/preview") return children;
  return <AdminWorkspace>{children}</AdminWorkspace>;
}

function AdminWorkspace({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [access, setAccess] = useState<{ operations: boolean; insights: boolean } | null>(null);
  const [failure, setFailure] = useState("");
  const [login, setLogin] = useState(false);
  const [retry, setRetry] = useState(0);
  const [demo, setDemo] = useState(false);
  const isInsights = pathname.startsWith("/admin/insights");
  const menus = permittedAdminMenu(access);
  const activeMenu = pathname.startsWith("/admin/analytics")
    ? ADMIN_MENU[0]
    : ADMIN_MENU.find(item => item.href === "/admin" ? pathname === item.href : pathname.startsWith(item.href));

  useEffect(() => {
    document.documentElement.classList.add("admin-stable-scroll");
    return () => document.documentElement.classList.remove("admin-stable-scroll");
  }, []);

  useEffect(() => {
    let active = true;
    setAccess(null); setFailure(""); setLogin(false);
    // 인사이트와 운영 조회 중 허용된 영역만 열고 서버의 권한 검사를 유지합니다.
    Promise.allSettled([
      requestApi<{ can_read_operations: boolean }>("/admin/operations/access"),
      requestApi<{ can_manage_insights: boolean }>("/admin/insights/access"),
    ]).then(([operations, insights]) => {
      if (!active) return;
      setAccess({ operations: operations.status === "fulfilled" && operations.value.can_read_operations === true, insights: insights.status === "fulfilled" && insights.value.can_manage_insights === true });
      const failed = [operations, insights].filter(result => result.status === "rejected");
      setLogin(failed.some(result => result.status === "rejected" && result.reason instanceof ApiError && result.reason.status === 401));
      const unexpected = failed.find(result => result.status === "rejected" && (!(result.reason instanceof ApiError) || ![401, 403, 404].includes(result.reason.status ?? 0)));
      if (unexpected?.status === "rejected") setFailure(unexpected.reason instanceof Error ? unexpected.reason.message : "권한 확인 중 오류가 발생했습니다.");
    });
    return () => { active = false; };
  }, [retry]);

  useEffect(() => {
    if (!access) return;
    const next = adminFallbackPath(access, pathname);
    if (next) router.replace(next);
  }, [access, pathname, router]);

  return <PageContainer className={styles.shell}>
    <aside className={styles.sidebar}>
      <div className={styles.sidebarTitle}><strong>관리자 워크스페이스</strong><small>LABBRIDGE</small></div>
      <nav className={styles.nav} aria-label="관리자 메뉴">
        {menus.map(item => <Link key={item.href} href={adminHref(item.href, demo)} className={styles.navLink} aria-current={activeMenu?.href === item.href ? "page" : undefined}><AdminIcon name={item.icon} />{item.label}</Link>)}
      </nav>
      <div className={styles.sidebarFoot}><AdminIcon name="lock" size={13} />권한이 있는 메뉴만 표시됩니다</div>
    </aside>
    <div className={styles.main}>
      <Suspense fallback={<div className={styles.pageFallback} role="status">관리자 화면을 준비하고 있습니다…</div>}>
        <AdminMain access={access} failure={failure} login={login} isInsights={isInsights} onDemo={setDemo} onRetry={() => setRetry(value => value + 1)}>{children}</AdminMain>
      </Suspense>
    </div>
  </PageContainer>;
}

/** 주소 읽기는 본문 안에서만 해서, 메뉴를 바꿔도 사이드 박스는 그대로 둡니다. */
function AdminMain({ children, access, failure, login, isInsights, onDemo, onRetry }: { children: ReactNode; access: { operations: boolean; insights: boolean } | null; failure: string; login: boolean; isInsights: boolean; onDemo: (demo: boolean) => void; onRetry: () => void }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const router = useRouter();
  const demo = !isInsights && params.get("demo") === "1";
  useEffect(() => { onDemo(demo); }, [demo, onDemo]);

  function changeMode(nextDemo: boolean) {
    const next = new URLSearchParams(params);
    if (nextDemo) next.set("demo", "1"); else next.delete("demo");
    router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
  }

  const allowed = isInsights ? access?.insights : access?.operations;
  return <>
    {demo && allowed ? <div className={styles.demoNotice}><AdminIcon name="chart" /><strong>디자인 데모 · 가상 데이터</strong><span>2026.10.26 기준 예시입니다. 서버에 저장하지 않으며 실제 운영 수치가 아닙니다.</span></div> : null}
    {!access ? <div className={styles.empty} role="status">관리자 권한을 확인하고 있습니다…</div> : allowed ? <PreviewContext.Provider value={demo}><ChromeContext.Provider value={{ showMode: !isInsights, demo, setDemo: changeMode }}>{children}</ChromeContext.Provider></PreviewContext.Provider> : <section className={styles.panel}><div className={styles.empty}><h1 className="text-lg font-bold text-ink">{login ? "로그인이 필요합니다" : "이 메뉴의 관리 권한이 없습니다"}</h1><p className="mt-2">{failure || "회원·연구 조회와 인사이트 운영은 서로 다른 권한으로 관리합니다."}</p><div className="mt-4 flex justify-center gap-3">{login ? <Link href="/login" className="text-brand underline">로그인</Link> : null}<button type="button" className="text-brand underline" onClick={onRetry}>권한 다시 확인</button></div></div></section>}
  </>;
}

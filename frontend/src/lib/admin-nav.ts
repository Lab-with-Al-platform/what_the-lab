/** 헤더 입구와 사이드 메뉴가 같이 쓰는 관리자 경로입니다. */

export const ADMIN_MENU = [
  { href: "/admin", label: "운영 요약", icon: "overview", area: "operations" },
  { href: "/admin/members", label: "회원 관리", icon: "members", area: "operations" },
  { href: "/admin/projects", label: "연구 등록", icon: "research", area: "operations" },
  { href: "/admin/insights", label: "인사이트 관리", icon: "insights", area: "insights" },
] as const;

/** 운영 조회가 있으면 워크스페이스 홈으로, 인사이트만 있으면 그 화면으로 갑니다. */
export function adminHomeHref(canReadOperations: boolean, canManageInsights: boolean): string | null {
  if (canReadOperations) return "/admin";
  if (canManageInsights) return "/admin/insights";
  return null;
}

/** 권한을 알기 전에는 메뉴를 비웁니다. 없는 권한 칸이 잠깐 보이지 않게 합니다. */
export function permittedAdminMenu(access: { operations: boolean; insights: boolean } | null) {
  if (!access) return [];
  return ADMIN_MENU.filter((item) => access[item.area]);
}

/** 지금 주소가 없는 권한이면, 있는 관리 화면으로 옮깁니다. */
export function adminFallbackPath(
  access: { operations: boolean; insights: boolean },
  pathname: string,
): string | null {
  const onInsights = pathname.startsWith("/admin/insights");
  if (!access.operations && access.insights && !onInsights) return "/admin/insights";
  if (access.operations && !access.insights && onInsights) return "/admin";
  return null;
}

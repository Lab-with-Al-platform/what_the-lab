/**
 * Community navigation contract.
 *
 * Public categories are *not* personal scopes: selecting any category from
 * a private/admin/saved view must return to the PUBLIC listing first.
 * Keep public search, status, unanswered and order; drop scope, page and tag.
 * Never carry sensitive query terms from a private/member/admin scope into public URLs.
 * The result is always a safe same-origin relative URL.
 */
import { CATEGORIES, type Category } from "@/lib/community";

export const COMMUNITY_ACTIVITY_LINKS = [
  { href: "/community?scope=mine", label: "내가 쓴 글·문의" },
  { href: "/community?scope=saved", label: "저장한 글" },
  { href: "/community?scope=notifications", label: "내 글의 새 답변" },
] as const;

export const COMMUNITY_ADMIN_LINKS = [
  { href: "/community?scope=inbox", label: "비공개 문의함" },
  { href: "/community?scope=moderation", label: "신고·숨김 관리" },
] as const;

export const COMMUNITY_CATEGORIES = Object.entries(CATEGORIES).map(
  ([key, label]) => ({ key: key as Category, label }),
);

/** Called only with a fixed UI category, never untrusted API identifiers. */
export function communityCategoryHref(queryString: string, category: Category | null): string {
  const source = new URLSearchParams(queryString);
  const next = new URLSearchParams();
  // Never copy unknown params or personal/admin queries into a public URL.
  // Only public-search filters approved by the existing backend can survive.
  if (!source.has("scope") || source.get("scope") === "public") {
    for (const [key, value] of source.entries()) {
      if (key === "q" && value.trim()) next.set("q", value.trim().slice(0, 200));
      if (key === "order" && ["latest", "helpful", "oldest"].includes(value)) next.set(key, value);
      if (key === "status" && ["open", "in_progress", "resolved"].includes(value)) next.set(key, value);
      if (key === "unanswered" && value === "1") next.set(key, value);
    }
  }
  if (category && Object.prototype.hasOwnProperty.call(CATEGORIES, category)) {
    next.set("category", category);
  }
  return next.size ? `/community?${next}` : "/community";
}

export function communityCategoryLabel(value: string | null): string {
  if (!value || !Object.prototype.hasOwnProperty.call(CATEGORIES, value)) {
    return "전체 대화";
  }
  return CATEGORIES[value as Category];
}

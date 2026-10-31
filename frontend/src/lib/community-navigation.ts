/**
 * Community navigation contract.
 *
 * Public categories are *not* personal scopes: selecting any category from
 * a private/admin/saved view must return to the PUBLIC listing first.
 * Keep search, status, unanswered and order; drop scope, page and tag.
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
  const params = new URLSearchParams(queryString);
  // Deliberately prevent a "mine/saved/inbox" scope from leaking into a public category.
  params.delete("scope");
  params.delete("page");
  // A tag from an unrelated category would otherwise produce confusing zero results.
  params.delete("tag");
  if (category && Object.prototype.hasOwnProperty.call(CATEGORIES, category)) {
    params.set("category", category);
  } else {
    params.delete("category");
  }
  const next = params.toString();
  return next ? `/community?${next}` : "/community";
}

export function communityCategoryLabel(value: string | null): string {
  if (!value || !Object.prototype.hasOwnProperty.call(CATEGORIES, value)) {
    return "전체 대화";
  }
  return CATEGORIES[value as Category];
}

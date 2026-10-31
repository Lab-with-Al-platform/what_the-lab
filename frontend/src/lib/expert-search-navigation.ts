/**
 * Expert-search return navigation is intentionally local-only.
 * It preserves search filters and the number of results previously loaded.
 * Do not store credentials or user data in return URLs.
 */
export type ExpertListContext = {
  query: string;
  works: string[];
  fields: string[];
  shown: number;
  focus?: number;
  researchId?: number | null;
};

export function restoredExpertCount(raw: string | null): number {
  if (!raw || !/^\d{1,3}$/.test(raw)) return 6;
  return Math.min(60, Math.max(6, Math.ceil(Number(raw) / 6) * 6));
}

export function expertListHref(context: ExpertListContext): string {
  const params = new URLSearchParams();
  const q = context.query.trim().slice(0, 50);
  if (q) params.set("q", q);
  if (context.works.length) params.set("works", context.works.join(",").slice(0, 200));
  if (context.fields.length) params.set("fields", context.fields.join(",").slice(0, 200));
  if (context.shown > 6) params.set("shown", String(restoredExpertCount(String(context.shown))));
  if (context.focus && Number.isSafeInteger(context.focus) && context.focus > 0) {
    params.set("focus", String(context.focus));
  }
  if (context.researchId && Number.isSafeInteger(context.researchId) && context.researchId > 0) {
    params.set("research", String(context.researchId));
  }
  const search = params.toString();
  return search ? `/experts?${search}` : "/experts";
}

/** Rebuild a trusted /experts-only link rather than trusting arbitrary 'from'. */
export function safeExpertBackHref(from?: string | string[] | null): string {
  if (typeof from !== "string" || !from.startsWith("/experts?") || from.length > 900) return "/experts";
  try {
    const target = new URL(from, "https://local.invalid");
    if (target.origin !== "https://local.invalid" || target.pathname !== "/experts" || target.hash) return "/experts";
    const query = target.searchParams.get("q")?.slice(0, 50) ?? "";
    const works = (target.searchParams.get("works") ?? "").split(",").filter((id) => /^UG[A-Za-z0-9]{1,8}$/.test(id)).slice(0, 24);
    const fields = (target.searchParams.get("fields") ?? "").split(",").filter((id) => /^F\d{1,3}$/.test(id)).slice(0, 15);
    const shown = restoredExpertCount(target.searchParams.get("shown"));
    const focusRaw = target.searchParams.get("focus");
    const focus = focusRaw && /^\d{1,12}$/.test(focusRaw) ? Number(focusRaw) : undefined;
    const researchRaw = target.searchParams.get("research");
    const researchId = researchRaw && /^\d{1,12}$/.test(researchRaw) ? Number(researchRaw) : undefined;
    return expertListHref({query,works,fields,shown,focus,researchId});
  } catch {
    return "/experts";
  }
}

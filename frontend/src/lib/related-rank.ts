// 맞는 글·전문가를 위로 올리는 규칙. 안 맞는 항목은 목록에서 빼지 않습니다.
import type { ExpertCardData, Names } from "@/lib/expert-search";
import type { InsightListItem } from "@/lib/insight-meta";
import type { CareerProfile } from "@/lib/my-career";
import type { Research } from "@/lib/my-research";

export type Interest = {
  workIds: string[];
  categoryIds: string[];
  workLabels: Map<string, string>;
  categoryLabels: Map<string, string>;
  fieldLabels: string[];
};

const MIN_LABEL = 4; // 짧은 말(의학)은 다른 글까지 집어 올리지 않습니다.

/** 지정한 연구가 있으면 그걸, 없으면 등록한 연구 중 첫 번째를 씁니다. */
export function interestFromResearch(researches: Research[], names: Names): Interest | null {
  const registered = researches.filter((item) => item.status === "registered");
  const pick = registered.find((item) => item.is_primary) ?? registered[0];
  if (!pick) return null;
  return buildInterest(pick.able_work_ids, categoriesOf(pick.field_ids, names), pick.field_ids, names);
}

export function interestFromExpert(profile: Pick<CareerProfile, "able_work_ids" | "domain_ids">, names: Names): Interest | null {
  const categoryIds = categoriesOf(profile.domain_ids, names);
  if (!profile.able_work_ids.length && !categoryIds.length) return null;
  return buildInterest(profile.able_work_ids, categoryIds, profile.domain_ids, names);
}

function categoriesOf(fieldIds: string[], names: Names): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const fieldId of fieldIds) {
    const categoryId = names.categoryOf.get(fieldId) ?? "";
    if (!categoryId || seen.has(categoryId)) continue;
    seen.add(categoryId);
    ids.push(categoryId);
  }
  return ids;
}

function buildInterest(workIds: string[], categoryIds: string[], fieldIds: string[], names: Names): Interest | null {
  if (!workIds.length && !categoryIds.length) return null;
  const fieldLabels = fieldIds.map((id) => names.fields.get(id) ?? "").filter((name) => name.length >= MIN_LABEL);
  return {
    workIds,
    categoryIds,
    workLabels: new Map(workIds.map((id) => [id, names.works.get(id) ?? id])),
    categoryLabels: new Map(categoryIds.map((id) => [id, names.categories.get(id) ?? id])),
    fieldLabels,
  };
}

/** 글이 관심 키워드와 같으면 한 줄 이유, 아니면 null. */
export function articleReason(article: InsightListItem, interest: Interest): string | null {
  const workId = (article.ableWorkIds ?? []).find((id) => interest.workIds.includes(id));
  if (workId) return `「${interest.workLabels.get(workId) ?? workId}」 키워드와 같아요`;
  const haystack = [article.field, article.topicLabel, ...article.domains, ...article.tags].join(" ");
  let reason: string | null = null;
  interest.categoryLabels.forEach((label) => {
    if (!reason && label && haystack.includes(label)) reason = `「${label}」 분야와 같아요`;
  });
  if (reason) return reason;
  for (const label of interest.fieldLabels) {
    if (haystack.includes(label)) return `「${label}」 분야와 같아요`;
  }
  interest.workLabels.forEach((label) => {
    if (!reason && labelHits(haystack, label)) reason = `「${label}」 키워드와 같아요`;
  });
  return reason;
}

export function expertReason(expert: ExpertCardData, interest: Interest, names: Names): string | null {
  const workId = expert.able_work_ids.find((id) => interest.workIds.includes(id));
  if (workId) return `「${names.works.get(workId) ?? workId}」 키워드와 같아요`;
  const categoryId = expert.domain_ids.map((id) => names.categoryOf.get(id) ?? "").find((id) => interest.categoryIds.includes(id));
  if (categoryId) return `「${names.categories.get(categoryId) ?? categoryId}」 분야와 같아요`;
  return null;
}

/** 관련 글을 앞에 두고, 각 묶음 안의 원래 순서는 유지합니다. */
export function rankRelated<T>(items: T[], isRelated: (item: T) => boolean): T[] {
  const matched: T[] = [];
  const rest: T[] = [];
  for (const item of items) (isRelated(item) ? matched : rest).push(item);
  return [...matched, ...rest];
}

function labelHits(haystack: string, label: string): boolean {
  const compact = (value: string) => value.toLowerCase().replace(/[\s·,\-/]/g, "");
  if (compact(label).length >= MIN_LABEL && compact(haystack).includes(compact(label))) return true;
  return label.split(/[·,]/).some((part) => part.trim().length >= MIN_LABEL && haystack.includes(part.trim()));
}

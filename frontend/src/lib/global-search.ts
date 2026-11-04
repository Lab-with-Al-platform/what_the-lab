import type { InsightListItem } from "@/lib/insight-meta";
import type { Faq } from "@/lib/faq";

/** The experts API accepts at most 50 characters. Keep URL and API limits aligned. */
export const GLOBAL_SEARCH_MAX_LENGTH = 50;
export const GLOBAL_SEARCH_PREVIEW_SIZE = 6;

export function normalizeGlobalQuery(value: string): string {
  return value.normalize("NFKC").replace(/\s+/g, " ").trim().slice(0, GLOBAL_SEARCH_MAX_LENGTH);
}

function normalize(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase("ko").replace(/\s+/g, " ").trim();
}

/** Match every typed word, independent of spacing across title/summary/tags. */
function matchesAllWords(query: string, fields: string[]): boolean {
  const words = normalize(query).split(" ").filter(Boolean);
  if (words.length === 0) return false;
  const text = normalize(fields.join(" "));
  return words.every((word) => text.includes(word));
}

/** Rank only inside each section; never let a later section jump above insights. */
function relevance(query: string, title: string, secondary: string[]): number {
  const key = normalize(query);
  const heading = normalize(title);
  const remaining = normalize(secondary.join(" "));
  const words = key.split(" ").filter(Boolean);
  return (heading === key ? 100 : heading.startsWith(key) ? 55 : heading.includes(key) ? 30 : 0)
    + words.filter((word) => heading.includes(word)).length * 16
    + words.filter((word) => remaining.includes(word)).length * 3
    + (remaining.includes(key) ? 12 : 0);
}

export function searchGlobalInsights(items: InsightListItem[], query: string): InsightListItem[] {
  return items
    .filter((item) => matchesAllWords(query, [
      item.title, item.summary, item.field, item.topicLabel, ...item.domains, ...item.tags,
    ]))
    .sort((a, b) => relevance(query, b.title, [b.summary, b.field, ...b.tags])
      - relevance(query, a.title, [a.summary, a.field, ...a.tags])
      || b.publishedOn.localeCompare(a.publishedOn) || a.slug.localeCompare(b.slug));
}

export function searchGlobalFaqs(items: Faq[], query: string): Faq[] {
  return items
    .filter((faq) => matchesAllWords(query, [
      faq.question, ...faq.answer, ...faq.keywords,
    ]))
    .sort((a, b) => relevance(query, b.question, [...b.answer, ...b.keywords])
      - relevance(query, a.question, [...a.answer, ...a.keywords])
      || a.question.localeCompare(b.question));
}

/** Shareable source-page deep links, with safe URLSearchParams encoding. */
export function globalSearchSourceHref(source: "experts" | "community" | "faq", query: string): string {
  const params = new URLSearchParams({ q: normalizeGlobalQuery(query) });
  return "/" + source + "?" + params.toString();
}

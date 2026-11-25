/** 통계 탭 디자인 데모. 카드·그래프·목록이 같은 가상 일별 조회로 계산됩니다. 서버로 보내지 않습니다. */

export const DEMO_TODAY = "2026-10-26";
const DAY_COUNT = 80;
export type DemoKind = "case" | "trend";
export type ViewMetric = { status: "ready" | "not_collected" | "not_linked"; value: number | null; note?: string };
export type ViewPoint = { date: string; count: number; until?: string };
export type ViewArticle = {
  content_id: string; title: string; kind: DemoKind; slug: string; published_at: string;
  link_state: "linked" | "needs_link"; public_path: string | null;
  period_views: ViewMetric; cumulative_views: ViewMetric; share?: number | null;
};
export type ViewReport = {
  collection: { status: string; enabled: boolean; started_at: string | null; timezone: string; generated_at: string; note: string };
  range: { preset: string; start: string; end: string; includes_today: boolean; timezone: string; note: string };
  cards: { published: ViewMetric; period_views: ViewMetric; cumulative_views: ViewMetric; viewed_articles: ViewMetric };
  series: ViewPoint[];
  kinds: { label: string; value: number }[];
  top: ViewArticle[];
  articles: { items: ViewArticle[]; total: number; page: number; page_size: number; search_applies_to: "articles" };
};

export function shiftDate(iso: string, days: number): string {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, (month ?? 1) - 1, (day ?? 1) + days));
  return date.toISOString().slice(0, 10);
}

function allDates(): string[] {
  return Array.from({ length: DAY_COUNT }, (_, index) => shiftDate(DEMO_TODAY, index - (DAY_COUNT - 1)));
}

const ARTICLES = Array.from({ length: 26 }, (_, index) => {
  const kind: DemoKind = index % 3 === 0 ? "trend" : "case";
  const title = index === 1
    ? "가상 사례 2 · 아주 긴 제목이 목록에서 말줄임되고 전체 제목은 포인터를 올렸을 때 보이는지 확인하는 디자인 전용 문장"
    : `가상 ${kind === "case" ? "사례" : "트렌드"} ${index + 1} · 통계 화면 전용`;
  return { index, kind, title, content_id: `demo-${index + 1}`, slug: `demo-view-${index + 1}`, published_on: shiftDate(DEMO_TODAY, -20 - (index % 17)) };
});

/** 조회가 몰린 글, 후반에 늘어난 글, 한 번도 조회되지 않은 글을 한 함수로 섞습니다. */
export function demoCount(index: number, iso: string): number {
  const dayIndex = allDates().indexOf(iso);
  if (dayIndex < 0 || index % 7 === 0) return 0;
  if (index % 5 === 0) return dayIndex >= 55 ? 8 + (index % 4) : 1;
  if (index % 4 === 0) return 12 + (dayIndex % 9);
  return 1 + ((index * 3 + dayIndex) % 5);
}

function rangeOf(preset: string): { start: string; end: string } {
  if (preset === "today") return { start: DEMO_TODAY, end: DEMO_TODAY };
  if (preset === "7d") return { start: shiftDate(DEMO_TODAY, -6), end: DEMO_TODAY };
  if (preset === "month") return { start: "2026-10-01", end: DEMO_TODAY };
  return { start: shiftDate(DEMO_TODAY, -29), end: DEMO_TODAY };
}

function between(iso: string, start: string, end: string): boolean {
  return iso >= start && iso <= end;
}

function periodOf(index: number, start: string, end: string): number {
  return allDates().reduce((sum, iso) => sum + (between(iso, start, end) ? demoCount(index, iso) : 0), 0);
}

function cumulativeOf(index: number): number {
  return allDates().reduce((sum, iso) => sum + demoCount(index, iso), 0);
}

function weekdayMonday(iso: string): number {
  const date = new Date(`${iso}T00:00:00Z`);
  return (date.getUTCDay() + 6) % 7;
}

function buckets(start: string, end: string, grain: "day" | "week" | "month", indexes: number[]): ViewPoint[] {
  if (grain === "day") {
    return allDates().filter(iso => between(iso, start, end)).map(iso => ({
      date: iso,
      count: indexes.reduce((sum, index) => sum + demoCount(index, iso), 0),
    }));
  }
  const points: ViewPoint[] = [];
  let cursor = start;
  while (cursor <= end) {
    const next = grain === "week"
      ? shiftDate(cursor, 6 - weekdayMonday(cursor))
      : shiftDate(`${cursor.slice(0, 7)}-01`, 32).slice(0, 7) + "-01";
    const until = grain === "week" ? (next > end ? end : next) : shiftDate(next, -1) > end ? end : shiftDate(next, -1);
    const count = allDates().filter(iso => between(iso, cursor, until)).reduce((sum, iso) => sum + indexes.reduce((inner, index) => inner + demoCount(index, iso), 0), 0);
    points.push({ date: grain === "month" ? cursor.slice(0, 7) : cursor, count, until });
    cursor = shiftDate(until, 1);
  }
  return points;
}

function row(index: number, start: string, end: string, periodTotal: number): ViewArticle {
  const article = ARTICLES[index];
  const period = periodOf(index, start, end);
  return {
    content_id: article.content_id, title: article.title, kind: article.kind, slug: article.slug,
    published_at: `${article.published_on}T00:00:00+09:00`, link_state: "linked", public_path: null,
    period_views: { status: "ready", value: period, note: "선택 기간 조회수" },
    cumulative_views: { status: "ready", value: cumulativeOf(index), note: "측정 이후 누적 조회수" },
    share: periodTotal ? period / periodTotal : null,
  };
}

export function demoStatistics(options: { preset?: string; kind?: string; grain?: "day" | "week" | "month"; q?: string; page?: number; order?: string } = {}): ViewReport {
  const preset = options.preset || "30d";
  const grain = options.grain || "day";
  const { start, end } = rangeOf(preset);
  const indexes = ARTICLES.map(item => item.index).filter(index => !options.kind || ARTICLES[index].kind === options.kind);
  const periodTotal = indexes.reduce((sum, index) => sum + periodOf(index, start, end), 0);
  const rows = indexes.map(index => row(index, start, end, periodTotal));
  const needle = (options.q || "").trim().toLowerCase();
  const listed = rows.filter(item => !needle || item.title.toLowerCase().includes(needle));
  listed.sort((left, right) => {
    if (options.order === "cumulative") return (right.cumulative_views.value ?? 0) - (left.cumulative_views.value ?? 0);
    if (options.order === "newest") return right.published_at.localeCompare(left.published_at);
    return (right.period_views.value ?? 0) - (left.period_views.value ?? 0);
  });
  const page = options.page || 1;
  return {
    collection: { status: "ready", enabled: false, started_at: `${allDates()[0]}T00:00:00+09:00`, timezone: "Asia/Seoul", generated_at: `${DEMO_TODAY}T12:00:00+09:00`, note: "디자인 데모입니다. 서버에 저장하지 않습니다." },
    range: { preset, start, end, includes_today: end === DEMO_TODAY, timezone: "Asia/Seoul", note: "가상 기준일 2026-10-26 · 오늘이 포함된 구간의 증감률은 만들지 않습니다." },
    cards: {
      published: { status: "ready", value: indexes.length, note: "현재 가상 게시글 수입니다. 선택 기간의 게시 수가 아닙니다." },
      period_views: { status: "ready", value: periodTotal, note: "선택 기간의 조회수(PV)" },
      cumulative_views: { status: "ready", value: indexes.reduce((sum, index) => sum + cumulativeOf(index), 0), note: "측정 이후 누적 조회수. 기간 필터와 무관합니다." },
      viewed_articles: { status: "ready", value: rows.filter(item => (item.period_views.value ?? 0) > 0).length, note: "조회가 있던 글 수. 방문자 수가 아닙니다." },
    },
    series: buckets(start, end, grain, indexes),
    kinds: [
      { label: "협업사례", value: indexes.filter(index => ARTICLES[index].kind === "case").reduce((sum, index) => sum + periodOf(index, start, end), 0) },
      { label: "AI 트렌드", value: indexes.filter(index => ARTICLES[index].kind === "trend").reduce((sum, index) => sum + periodOf(index, start, end), 0) },
    ],
    top: [...rows].sort((left, right) => (right.period_views.value ?? 0) - (left.period_views.value ?? 0)).slice(0, 5),
    articles: { items: listed.slice((page - 1) * 6, page * 6), total: listed.length, page, page_size: 6, search_applies_to: "articles" },
  };
}

export function demoDetail(contentId: string, preset = "30d", grain: "day" | "week" | "month" = "day") {
  const article = ARTICLES.find(item => item.content_id === contentId);
  if (!article) return null;
  const report = demoStatistics({ preset, grain });
  const { start, end } = report.range;
  const current = row(article.index, start, end, report.cards.period_views.value ?? 0);
  return {
    ...report,
    title: article.title,
    kind: article.kind,
    content_id: article.content_id,
    slug: article.slug,
    published_at: current.published_at,
    link_state: "linked" as const,
    public_path: null,
    period_views: current.period_views,
    cumulative_views: current.cumulative_views,
    series: buckets(start, end, grain, [article.index]),
  };
}

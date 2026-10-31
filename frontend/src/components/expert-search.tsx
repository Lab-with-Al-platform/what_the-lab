"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ExpertSearchHero } from "@/components/expert-search-hero";
import { PageContainer } from "@/components/page-container";
import { expertListHref, restoredExpertCount } from "@/lib/expert-search-navigation";

import { ApiError, requestApi } from "@/lib/api";
import { photoOrDefault } from "@/lib/collab-requests";
import { buildNames, categoryNames, engagedLabel, headAndRest, splitTaxonomyIds, type ExpertCardData, type ExpertSearchResult, type Names } from "@/lib/expert-search";
import { CAREER_LABELS, JOB_LABELS, type AbleWorkOption, type CareerProfile, type FieldCategory } from "@/lib/my-career";
import { DATA_STATUS_LABELS, type Research } from "@/lib/my-research";
import { expertReason, interestFromExpert, interestFromResearch, type Interest } from "@/lib/related-rank";

type Panel = "research" | null;
type Engagement = "all" | "idle" | "engaged";
type SortOrder = "relevance" | "newest";
type Role = "researcher" | "expert" | null; // null = 로그인 안 했거나 유형 미선택

/** AI 전문가 찾기. 공개 전문가를 탐색하고 상세 프로필을 검토한 뒤 협업을 요청합니다. */
export function ExpertSearch() {
  const searchParams = useSearchParams();
  const incomingQuery = (searchParams.get("q") ?? searchParams.get("skill") ?? "").slice(0, 50);
  const incomingWorksKey = searchParams.get("works") ?? "";
  const incomingFieldsKey = searchParams.get("fields") ?? "";
  const incomingWorks = splitTaxonomyIds(incomingWorksKey, "work");
  const incomingFields = splitTaxonomyIds(incomingFieldsKey, "category");
  const [ableWorks, setAbleWorks] = useState<AbleWorkOption[]>([]);
  const [categories, setCategories] = useState<FieldCategory[]>([]);
  const [role, setRole] = useState<Role>(null);
  const [researches, setResearches] = useState<Research[] | null>(null); // 연구회원의 등록한 연구
  const [expertProfile, setExpertProfile] = useState<CareerProfile | null>(null);

  const [draft, setDraft] = useState(incomingQuery); // 게시판 태그·홈에서 넘어온 검색어도 반영
  const [query, setQuery] = useState(incomingQuery); // [검색]을 눌러 적용한 검색어
  const [works, setWorks] = useState<string[]>(incomingWorks);
  const [fields, setFields] = useState<string[]>(incomingFields); // 대분류 ID
  const [applied, setApplied] = useState<Research | null>(null); // [내 연구로 찾기]로 고른 연구
  const [panel, setPanel] = useState<Panel>(null);
  const initialEngagement = searchParams.get("engagement");
  const [engagement, setEngagement] = useState<Engagement>(initialEngagement === "idle" || initialEngagement === "engaged" ? initialEngagement : "all");
  const [sort, setSort] = useState<SortOrder>(searchParams.get("sort") === "newest" ? "newest" : "relevance");
  const [fieldKeyword, setFieldKeyword] = useState("");
  const [expandedWorks, setExpandedWorks] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const [result, setResult] = useState<ExpertSearchResult | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const searchGeneration = useRef(0);
  const [error, setError] = useState("");
  const restoredFocus = useRef<number | null>(null);

  useEffect(() => {
    setDraft(incomingQuery);
    setQuery(incomingQuery);
    setWorks(splitTaxonomyIds(incomingWorksKey, "work"));
    setFields(splitTaxonomyIds(incomingFieldsKey, "category"));
    const initialStatus = searchParams.get("engagement");
    setEngagement(initialStatus === "idle" || initialStatus === "engaged" ? initialStatus : "all");
    setSort(searchParams.get("sort") === "newest" ? "newest" : "relevance");
  }, [incomingQuery, incomingWorksKey, incomingFieldsKey, searchParams]);

  // Return links only preserve the selected research label if it belongs to this researcher.
  useEffect(() => {
    const rawId = searchParams.get("research");
    if (role !== "researcher" || !researches || !rawId || !/^\d+$/.test(rawId)) return;
    const research = researches.find((item) => item.research_id === Number(rawId));
    if (research) setApplied((current) => current ?? research);
  }, [researches, role, searchParams]);

  // 처음 한 번: 보기 목록(맡길 일·분야)과 로그인 정보
  useEffect(() => {
    Promise.all([requestApi<AbleWorkOption[]>("/expert/able-works"), requestApi<FieldCategory[]>("/taxonomy/fields")])
      .then(([workList, categoryList]) => {
        setAbleWorks(workList);
        setCategories(categoryList);
      })
      .catch(() => setError("보기 목록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요"));
    requestApi<{ user_role: Role }>("/auth/me")
      .then((me) => {
        setRole(me.user_role);
        if (me.user_role === "researcher") {
          requestApi<Research[]>("/researcher/researches")
            .then((list) => setResearches(list.filter((item) => item.status === "registered")))
            .catch(() => setResearches([]));
        }
        if (me.user_role === "expert") {
          requestApi<CareerProfile>("/expert/profile")
            .then(setExpertProfile)
            .catch(() => setExpertProfile(null));
        }
      })
      .catch(() => setRole(null)); // 로그인 안 함: 목록은 그대로 볼 수 있어요
  }, []);

  const names = useMemo<Names>(() => buildNames(ableWorks, categories), [ableWorks, categories]);
  const interest = useMemo(() => {
    if (role === "researcher" && researches) return interestFromResearch(researches, names);
    if (role === "expert" && expertProfile) return interestFromExpert(expertProfile, names);
    return null;
  }, [expertProfile, names, researches, role]);
  const preferWorksKey = works.length === 0 && fields.length === 0 ? (interest?.workIds ?? []).join(",") : "";
  const preferFieldsKey = works.length === 0 && fields.length === 0 ? (interest?.categoryIds ?? []).join(",") : "";

  const search = useCallback(
    async (offset: number) => {
      const params = new URLSearchParams({ q: query, works: works.join(","), fields: fields.join(","), engagement, sort, offset: String(offset) });
      if (preferWorksKey) params.set("prefer_works", preferWorksKey);
      if (preferFieldsKey) params.set("prefer_fields", preferFieldsKey);
      return requestApi<ExpertSearchResult>(`/experts?${params}`);
    },
    [engagement, fields, preferFieldsKey, preferWorksKey, query, sort, works],
  );

  // Returning from a profile restores the filters and previously expanded result pages (up to 60).
  const sameFilters = query === incomingQuery &&
    works.join(",") === incomingWorks.join(",") &&
    fields.join(",") === incomingFields.join(",") &&
    engagement === (searchParams.get("engagement") === "idle" || searchParams.get("engagement") === "engaged" ? searchParams.get("engagement") : "all") &&
    sort === (searchParams.get("sort") === "newest" ? "newest" : "relevance");
  const restoreCount = sameFilters ? restoredExpertCount(searchParams.get("shown")) : 6;

  useEffect(() => {
    let alive = true;
    searchGeneration.current += 1;
    setLoadingMore(false);
    setResult(null);
    async function run() {
      try {
        const first = await search(0);
        const items = [...first.items];
        const target = Math.min(first.total, restoreCount);
        while (alive && items.length < target) {
          const next = await search(items.length);
          if (!next.items.length) break;
          items.push(...next.items);
        }
        if (alive) {
          setResult({ ...first, items });
          setError("");
        }
      } catch (caught) {
        if (alive) setError(caught instanceof ApiError ? caught.message : "잠시 후 다시 시도해 주세요");
      }
    }
    void run();
    return () => {
      alive = false;
      searchGeneration.current += 1;
    };
  }, [search, restoreCount]);

  async function loadMore() {
    if (!result || loadingMore) return;
    const generation = searchGeneration.current;
    setLoadingMore(true);
    try {
      const next = await search(result.items.length);
      if (generation !== searchGeneration.current) return;
      setResult({ ...next, items: [...result.items, ...next.items] });
    } catch (caught) {
      if (generation === searchGeneration.current) setError(caught instanceof ApiError ? caught.message : "잠시 후 다시 시도해 주세요");
    } finally {
      if (generation === searchGeneration.current) setLoadingMore(false);
    }
  }

  // The focused expert is highlighted and scrolled into view after asynchronous list restoration.
  useEffect(() => {
    const focus = Number(searchParams.get("focus"));
    if (!result || !Number.isSafeInteger(focus) || focus <= 0 || restoredFocus.current === focus) return;
    const link = document.getElementById(`expert-profile-${focus}`);
    if (!link) return;
    restoredFocus.current = focus;
    window.requestAnimationFrame(() => {
      link.scrollIntoView({ block: "center", behavior: "auto" });
      link.focus({ preventScroll: true });
    });
  }, [result, searchParams]);

  function onSearch(event: FormEvent) {
    event.preventDefault();
    setQuery(draft.trim());
  }

  function toggle(list: string[], id: string, set: (next: string[]) => void) {
    set(list.includes(id) ? list.filter((item) => item !== id) : [...list, id]);
  }

  function applyResearch(research: Research) {
    setApplied(research);
    setWorks(research.able_work_ids);
    setFields([...new Set(research.field_ids.map((id) => names.categoryOf.get(id)).filter((id): id is string => Boolean(id)))]);
    setPanel(null);
  }

  function clearAll() {
    setWorks([]);
    setFields([]);
    setApplied(null);
    setEngagement("all");
  }

  function resetSearch() {
    clearAll();
    setDraft("");
    setQuery("");
    setSort("relevance");
    setFieldKeyword("");
  }

  function toggleWork(id: string) {
    setApplied(null);
    toggle(works, id, setWorks);
  }

  function toggleField(id: string) {
    setApplied(null);
    toggle(fields, id, setFields);
  }

  const chips = [
    ...works.map((id) => ({ key: id, label: names.works.get(id) ?? id, remove: () => toggleWork(id) })),
    ...fields.map((id) => ({ key: id, label: names.categories.get(id) ?? id, remove: () => toggleField(id) })),
  ];
  const matchedNames = result
    ? [...result.matched.able_work_ids.map((id) => names.works.get(id)), ...result.matched.field_ids.map((id) => names.fields.get(id))].filter(Boolean)
    : [];

  const visibleWorks = ableWorks.filter((item) => expandedWorks || item.show_default || works.includes(item.able_work_id));
  const visibleFields = categories.filter((item) => item.name.toLowerCase().includes(fieldKeyword.trim().toLowerCase()));
  const featured = result?.items[0] ?? null;
  const listed = result?.items.slice(1) ?? [];
  const hasFilters = chips.length > 0 || query.length > 0 || engagement !== "all";
  const personalized = Boolean(preferWorksKey || preferFieldsKey);

  function returnHrefFor(expert: ExpertCardData) {
    return expertListHref({
      query, works, fields, shown: result?.items.length ?? 6,
      focus: expert.user_id, researchId: applied?.research_id, engagement, sort,
    });
  }

  const filterSidebar = (
    <aside aria-label="전문가 검색 필터" className="overflow-hidden rounded-2xl border border-line bg-white shadow-[0_8px_30px_rgba(18,32,75,0.035)]">
      <div className="px-4 pb-5 pt-5 sm:px-5">
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-bold text-ink">무엇을 맡길까요?</h2>
          <span className="text-[11px] font-medium text-faint">{works.length}개 선택</span>
        </div>
        <fieldset className="mt-3 space-y-1.5">
          <legend className="sr-only">수행 기술 필터</legend>
          {visibleWorks.map((item) => (
            <label key={item.able_work_id} className={"flex min-h-9 cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] transition-colors " + (works.includes(item.able_work_id) ? "bg-[#eef1ff] font-semibold text-[#354d9e]" : "text-muted hover:bg-page")}>
              <input type="checkbox" checked={works.includes(item.able_work_id)} onChange={() => toggleWork(item.able_work_id)} className="size-4 shrink-0 accent-[#405dc3]" />
              <span className="min-w-0 leading-5">{item.name}</span>
            </label>
          ))}
          {ableWorks.length === 0 && <p className="px-2 text-xs text-faint">기술 항목을 불러오는 중입니다.</p>}
        </fieldset>
        {ableWorks.some((item) => !item.show_default && !works.includes(item.able_work_id)) && (
          <button type="button" className="mt-2 min-h-9 px-2 text-[12px] font-semibold text-brand hover:underline" onClick={() => setExpandedWorks((current) => !current)}>
            {expandedWorks ? "기본 항목만 보기 −" : "기술 항목 더 보기 +"}
          </button>
        )}
      </div>
      <div className="border-t border-line px-4 pb-5 pt-5 sm:px-5">
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-bold text-ink">연구 분야</h2>
          <span className="text-[11px] font-medium text-faint">{fields.length}개 선택</span>
        </div>
        <label className="relative mt-3 block">
          <span className="sr-only">연구 분야 목록에서 검색</span>
          <input value={fieldKeyword} onChange={(event) => setFieldKeyword(event.target.value)} placeholder="연구 분야 검색하기" className="h-10 w-full rounded-lg border border-line bg-page px-3 pr-9 text-[12px] text-ink placeholder:text-faint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/10" />
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="absolute right-3 top-3 size-4 text-faint"><circle cx="11" cy="11" r="7"/><path d="m16 16 4 4"/></svg>
        </label>
        <fieldset className="mt-3 space-y-1.5">
          <legend className="sr-only">연구 분야 대분류 필터</legend>
          {!fieldKeyword && (
            <label className={"flex min-h-9 cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] " + (fields.length === 0 ? "bg-[#eef1ff] font-semibold text-[#354d9e]" : "text-muted hover:bg-page")}>
              <input type="checkbox" checked={fields.length === 0} onChange={() => { setFields([]); setApplied(null); }} className="size-4 accent-[#405dc3]" />
              <span>전체 분야</span>
            </label>
          )}
          {visibleFields.map((item) => (
            <label key={item.field_category_id} className={"flex min-h-9 cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] " + (fields.includes(item.field_category_id) ? "bg-[#eef1ff] font-semibold text-[#354d9e]" : "text-muted hover:bg-page")}>
              <input type="checkbox" checked={fields.includes(item.field_category_id)} onChange={() => toggleField(item.field_category_id)} className="size-4 shrink-0 accent-[#405dc3]" />
              <span className="leading-5">{item.name}</span>
            </label>
          ))}
          {categories.length > 0 && visibleFields.length === 0 && <p className="px-2 py-2 text-xs text-muted">일치하는 분야가 없어요.</p>}
        </fieldset>
      </div>
      <div className="border-t border-line px-4 pb-5 pt-5 sm:px-5">
        <h2 className="text-[15px] font-bold text-ink">참여 상태</h2>
        <p className="mt-1 text-[11px] leading-5 text-faint">진행 중인 협업 여부를 기준으로 표시합니다.</p>
        <fieldset className="mt-3 space-y-1.5">
          <legend className="sr-only">참여 상태 필터</legend>
          {([
            { value: "all", label: "전체 전문가" },
            { value: "idle", label: "진행 중인 협업 없음" },
            { value: "engaged", label: "현재 협업 중" },
          ] as const).map((option) => (
            <label key={option.value} className={"flex min-h-9 cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] " + (engagement === option.value ? "bg-[#eef1ff] font-semibold text-[#354d9e]" : "text-muted hover:bg-page")}>
              <input type="radio" name="expert-engagement" checked={engagement === option.value} onChange={() => setEngagement(option.value)} className="size-4 shrink-0 accent-[#405dc3]" />
              <span>{option.label}</span>
            </label>
          ))}
        </fieldset>
      </div>
      {role !== "expert" && (
        <div className="border-t border-line bg-[#f5f7ff] p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <span className="rounded-full bg-[#e6ebff] px-2 py-0.5 text-[10px] font-bold uppercase text-[#4563bf]">MY RESEARCH</span>
            <span aria-hidden="true" className="text-brand">↗</span>
          </div>
          <h2 className="mt-2 text-[14px] font-bold text-ink">내 연구로 찾기</h2>
          <p className="mt-1 text-[11px] leading-5 text-muted">등록한 연구에 맞는 전문가를 더 빠르게 찾아보세요.</p>
          <button type="button" onClick={() => { if (applied) clearAll(); else setPanel(panel === "research" ? null : "research"); }} aria-expanded={panel === "research"} className="mt-3 inline-flex min-h-10 w-full items-center justify-center rounded-lg border border-[#ccd6ff] bg-white px-3 text-xs font-semibold text-[#3659ae] transition-colors hover:bg-[#eff2ff]">
            {applied ? "내 연구 적용 해제" : "내 연구 전문가 찾기"} <span aria-hidden="true" className="ml-2">→</span>
          </button>
          {panel === "research" && <ResearchPicker role={role} researches={researches} names={names} onPick={(research) => {applyResearch(research);setMobileFiltersOpen(false);}} />}
          {applied && <p className="mt-2 break-words text-[11px] font-semibold text-[#4563bf]">적용 중 · {applied.title}</p>}
        </div>
      )}
    </aside>
  );

  return (
    <PageContainer className="pb-20 pt-5 md:pt-7">
      <ExpertSearchHero />
      <div className="mb-3 flex items-center justify-between gap-3 md:hidden">
        <span className="text-sm font-semibold text-ink">AI 전문가 탐색</span>
        <button type="button" aria-expanded={mobileFiltersOpen} aria-controls="expert-filter-sidebar" onClick={() => setMobileFiltersOpen((value) => !value)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-line bg-white px-4 text-sm font-semibold text-ink">
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 7h16M7 12h10M10 17h4"/></svg>
          필터 {works.length + fields.length + (engagement === "all" ? 0 : 1) > 0 ? "(" + (works.length + fields.length + (engagement === "all" ? 0 : 1)) + ")" : ""}
        </button>
      </div>
      <div className="grid items-start gap-5 md:grid-cols-[210px_minmax(0,1fr)] lg:grid-cols-[245px_minmax(0,1fr)] lg:gap-6">
        <div id="expert-filter-sidebar" className={(mobileFiltersOpen ? "block " : "hidden ") + "md:sticky md:top-24 md:block"}>
          {filterSidebar}
        </div>
        <main className="min-w-0">
          <section aria-label="전문가 키워드 검색" className="rounded-2xl border border-line bg-white p-3 shadow-[0_7px_26px_rgba(18,32,75,0.04)] sm:p-4">
            <form onSubmit={onSearch} className="flex flex-col gap-2 sm:flex-row">
              <label htmlFor="expert-query" className="flex min-w-0 flex-1 items-center gap-3 rounded-xl border border-line bg-[#fcfdff] px-4 focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/10">
                <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" stroke="#97a6c5" strokeWidth="1.8" fill="none"><circle cx="11" cy="11" r="7"/><path d="m16 16 4 4"/></svg>
                <span className="sr-only">전문가 이름, 소속, 연구 키워드</span>
                <input id="expert-query" value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={50} placeholder="전문가 이름, 소속, 연구 키워드를 검색해보세요." className="h-11 min-w-0 w-full flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-faint" />
              </label>
              <button type="submit" className="min-h-11 rounded-xl bg-[#152b59] px-7 text-sm font-semibold text-white transition-colors hover:bg-[#273e72] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">검색</button>
            </form>
            {hasFilters && (
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                {query && (
                  <button type="button" onClick={() => {setQuery("");setDraft("");}} className="rounded-full bg-[#eef1ff] px-3 py-1.5 text-xs font-semibold text-[#435cac]">
                    {query} <span aria-hidden="true">×</span><span className="sr-only"> 검색어 해제</span>
                  </button>
                )}
                {chips.map((chip) => (
                  <button key={chip.key} type="button" onClick={chip.remove} className="rounded-full bg-[#eef1ff] px-3 py-1.5 text-xs font-semibold text-[#435cac]">
                    {chip.label} <span aria-hidden="true">×</span><span className="sr-only"> 조건 해제</span>
                  </button>
                ))}
                {engagement !== "all" && (
                  <button type="button" onClick={() => setEngagement("all")} className="rounded-full bg-[#eef1ff] px-3 py-1.5 text-xs font-semibold text-[#435cac]">
                    {engagement === "idle" ? "진행 중 협업 없음" : "현재 협업 중"} <span aria-hidden="true">×</span>
                  </button>
                )}
                <button type="button" onClick={resetSearch} className="ml-1 min-h-8 px-2 text-xs font-medium text-muted underline-offset-4 hover:underline">필터 초기화 ↻</button>
              </div>
            )}
            {!hasFilters && <p className="mt-3 px-1 text-[11px] text-faint">키워드와 왼쪽 필터를 조합해 적합한 전문가를 찾아보세요.</p>}
          </section>

          {applied && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#d9e2ff] bg-[#f3f6ff] px-4 py-3 text-xs text-[#475b84]">
              <span>내 연구 <strong>「{applied.title}」</strong> 기준으로 검색 중입니다. 필터는 언제든 변경할 수 있어요.</span>
              <button type="button" onClick={clearAll} className="font-semibold text-[#405ac2]">적용 해제</button>
            </div>
          )}
          {query && matchedNames.length > 0 && (
            <p className="mt-3 rounded-xl bg-[#f3f6ff] px-4 py-3 text-[12px] text-[#51607d]">
              &lsquo;{query}&rsquo;와 관련된 기술·연구 분야도 함께 검색합니다: {matchedNames.slice(0,3).join(" · ")}{matchedNames.length > 3 ? " 외" : ""}
            </p>
          )}

          {result && featured && (
            <section aria-labelledby="featured-expert-heading" className="mt-5 rounded-2xl border border-[#e1e8fb] bg-[#f5f7ff] p-3 shadow-[0_8px_26px_rgba(18,32,75,0.04)] sm:p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span aria-hidden="true" className="text-[#506be2]">✦</span>
                  <h2 id="featured-expert-heading" className="text-[15px] font-bold text-[#263e7d]">추천 전문가</h2>
                  <span className="text-[11px] text-faint">현재 검색 조건에서 먼저 표시되는 전문가입니다.</span>
                </div>
                <span className="text-[11px] text-[#7a8aac]">실제 등록 프로필 기준</span>
              </div>
              <FeaturedExpert expert={featured} names={names} interest={personalized ? interest : null} returnHref={returnHrefFor(featured)} />
            </section>
          )}

          <section aria-labelledby="expert-results-heading" className="mt-6">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 id="expert-results-heading" className="text-[18px] font-bold text-ink">전문가 <span className="text-[#385dc5]">{result ? result.total : "—"}명</span></h2>
                <p className="mt-1 text-[12px] text-muted">선택한 조건에 맞는 전문가 목록입니다.</p>
              </div>
              <label className="inline-flex items-center gap-2 text-xs text-muted">
                <span>정렬</span>
                <select aria-label="전문가 목록 정렬" value={sort} onChange={(event) => setSort(event.target.value as SortOrder)} className="min-h-10 rounded-lg border border-line bg-white px-3 font-semibold text-ink focus-visible:outline-2 focus-visible:outline-brand">
                  <option value="relevance">{personalized ? "맞춤 우선순" : "기본순"}</option>
                  <option value="newest">최신 등록순</option>
                </select>
              </label>
            </div>

            {error && <div role="alert" className="mb-3 rounded-xl border border-danger/20 bg-danger-soft p-4 text-sm text-danger">{error}</div>}
            {!result && !error && <div role="status" className="rounded-xl border border-line bg-white px-5 py-16 text-center text-sm text-muted">전문가를 불러오는 중입니다…</div>}
            {result && result.items.length === 0 && (
              <div className="rounded-2xl border border-dashed border-[#d6dfef] bg-white px-6 py-14 text-center">
                <div aria-hidden="true" className="mx-auto grid size-12 place-items-center rounded-full bg-[#f0f3fb] text-[#8b9cbd]">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="10.5" cy="10.5" r="7"/><path d="m16 16 5 5M8 10h5"/></svg>
                </div>
                <h3 className="mt-4 text-base font-bold text-ink">{hasFilters ? "조건에 맞는 전문가가 없어요." : "아직 공개된 전문가가 없어요."}</h3>
                <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted">{hasFilters ? "키워드 또는 필터를 조정하면 다른 전문가를 찾을 수 있습니다." : "전문가가 프로필을 공개하면 이곳에 목록이 표시됩니다."}</p>
                {hasFilters && <button type="button" onClick={resetSearch} className="mt-4 min-h-10 rounded-lg border border-line px-4 text-sm font-semibold text-brand">전체 조건 초기화</button>}
              </div>
            )}
            {result && result.items.length > 0 && (
              <>
                {listed.length > 0 && (
                  <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {listed.map((expert) => (
                      <li key={expert.user_id} className="h-full">
                        <ExpertCard expert={expert} names={names} interest={personalized ? interest : null} returnHref={returnHrefFor(expert)} />
                      </li>
                    ))}
                  </ul>
                )}
                {listed.length === 0 && <p className="rounded-xl border border-line bg-white px-5 py-5 text-sm text-muted">현재 검색 결과가 1명입니다. 위 추천 전문가의 프로필을 확인해보세요.</p>}
                {result.items.length < result.total && (
                  <div className="mt-6 text-center">
                    <button type="button" onClick={loadMore} disabled={loadingMore} className="min-h-11 rounded-xl border border-[#c9d4e9] bg-white px-7 text-sm font-semibold text-[#304a85] shadow-sm transition-colors hover:bg-[#f5f7ff] disabled:opacity-50">
                      {loadingMore ? "불러오는 중…" : "전문가 더 보기"}
                    </button>
                  </div>
                )}
              </>
            )}
            <p className="mt-4 text-[11px] leading-5 text-faint">전문가의 수행 경험과 협업 조건을 상세 프로필에서 확인한 후 협업을 요청할 수 있습니다. ‘진행 중인 협업 없음’은 즉시 협업 가능을 보장하지 않습니다.</p>
          </section>
        </main>
      </div>
    </PageContainer>
  );
}

function ResearchPicker({ role, researches, names, onPick }: { role: Role; researches: Research[] | null; names: Names; onPick: (research: Research) => void }) {
  if (role !== "researcher") {
    return (
      <div className="mt-3 rounded-card border border-line bg-page p-5 text-center text-sm text-muted">
        연구회원으로 로그인하면 내 연구로 바로 찾을 수 있어요.
        <Link href="/login" className="ml-2 font-semibold text-brand">
          로그인
        </Link>
      </div>
    );
  }
  if (researches === null) return <p className="mt-3 text-sm text-faint">불러오는 중…</p>;
  if (researches.length === 0) {
    return (
      <div className="mt-3 rounded-card border border-line bg-page p-6 text-center">
        <p className="text-sm font-semibold">아직 등록한 연구가 없어요</p>
        <p className="mt-1 text-xs text-muted">연구를 등록하면 그 연구에 맞는 전문가를 바로 찾아 드려요.</p>
        <Link href="/my-research" className="mt-3 inline-flex h-10 items-center rounded-button bg-brand px-4 text-sm font-semibold text-white">
          연구 등록하기
        </Link>
      </div>
    );
  }
  return (
    <div className="mt-3 rounded-card border border-line bg-page p-4">
      <p className="text-sm font-semibold">어떤 연구로 찾을까요?</p>
      <p className="mt-0.5 text-xs text-muted">고른 연구의 맡길 일과 분야로 필터가 채워져요.</p>
      <ul className="mt-3 space-y-2">
        {researches.map((research) => (
          <li key={research.research_id}>
            <button type="button" onClick={() => onPick(research)} className="w-full rounded-card border border-line bg-white p-3 text-left hover:border-brand">
              <span className="block text-sm font-semibold">{research.title}</span>
              <span className="mt-0.5 block text-xs text-muted">
                {categoryNames(research.field_ids, names).join(", ")}
                {research.data_status ? ` · ${DATA_STATUS_LABELS[research.data_status]}` : ""}
              </span>
              <span className="mt-2 flex flex-wrap gap-1.5">
                {research.able_work_ids.map((id) => (
                  <span key={id} className="rounded-full bg-brand-soft px-2 py-0.5 text-[11px] text-brand">
                    {names.works.get(id) ?? id}
                  </span>
                ))}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <Link href="/my-research" className="mt-3 inline-block text-xs font-semibold text-brand">
        + 새 연구 등록하기
      </Link>
    </div>
  );
}


function ProfilePortrait({ expert, featured = false }: { expert: ExpertCardData; featured?: boolean }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- Same dynamic Discord/default profile image strategy as the existing Avatar.
    <img
      src={photoOrDefault(expert.user_photo, "expert")}
      alt=""
      loading="lazy"
      className={featured ? "h-[142px] w-[132px] rounded-xl bg-page object-cover sm:h-[160px] sm:w-[152px]" : "size-[65px] rounded-xl bg-page object-cover"}
    />
  );
}

function EngagementBadge({ engaged }: { engaged: boolean }) {
  return (
    <span className={"inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold " + (engaged ? "bg-[#fff4e5] text-[#af761e]" : "bg-[#eaf7ef] text-[#20804e]")}>
      <span aria-hidden="true" className={"size-1.5 rounded-full " + (engaged ? "bg-[#e8a548]" : "bg-[#25ad69]")} />
      {engaged ? "현재 협업 중" : "진행 중 협업 없음"}
    </span>
  );
}

function FeaturedExpert({ expert, names, interest, returnHref }: { expert: ExpertCardData; names: Names; interest: Interest | null; returnHref: string }) {
  const tags = [...expert.domain_ids.map((id) => names.fields.get(id) ?? id), ...expert.able_work_ids.map((id) => names.works.get(id) ?? id)];
  const { shown, rest } = headAndRest(tags, 5);
  const reason = interest ? expertReason(expert, interest, names) : null;
  const href = "/experts/" + expert.user_id + "?from=" + encodeURIComponent(returnHref);
  return (
    <article className="flex flex-col gap-4 rounded-xl border border-[#e1e6f4] bg-white p-3 shadow-[0_4px_18px_rgba(20,43,89,0.06)] sm:flex-row sm:items-stretch sm:p-3.5">
      <div className="relative flex shrink-0 items-center justify-center rounded-xl bg-[#f1f4fb] sm:block">
        <ProfilePortrait expert={expert} featured />
        <span className="absolute left-2 top-2 rounded-full bg-[#4f6ed1] px-2 py-1 text-[10px] font-bold text-white shadow-sm">추천</span>
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-center py-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-[17px] font-bold text-ink">{expert.nickname}</h3>
          <EngagementBadge engaged={expert.engaged} />
        </div>
        <p className="mt-1 text-[12px] font-medium text-[#687b9c]">
          {[expert.affiliation, expert.current_job ? JOB_LABELS[expert.current_job] : null, expert.ai_career ? "AI 경력 " + (CAREER_LABELS[expert.ai_career] ?? expert.ai_career) : null].filter(Boolean).join(" · ") || "AI 전문가"}
        </p>
        <p className="mt-2 line-clamp-2 text-[13px] leading-6 text-muted">{expert.introduce || "프로필 소개를 확인해보세요."}</p>
        {reason && <p className="mt-1 text-xs font-semibold text-[#4966b8]">{reason}</p>}
        <ul aria-label="전문 분야 및 수행 기술" className="mt-3 flex flex-wrap gap-1.5">
          {shown.map((tag, i) => <li key={tag + i} className="rounded-full bg-[#eef2ff] px-2.5 py-1 text-[11px] font-semibold text-[#506ba5]">{tag}</li>)}
          {rest > 0 && <li className="rounded-full bg-page px-2.5 py-1 text-[11px] text-muted">+{rest}</li>}
        </ul>
      </div>
      <div className="flex shrink-0 flex-col justify-between gap-3 rounded-xl bg-[#f6f8fd] p-3 sm:w-[176px]">
        <div>
          <span className="text-[11px] font-semibold text-[#47618f]">현재 참여 상태</span>
          <p className="mt-1 text-[12px] leading-5 text-muted">{engagedLabel(expert) || "진행 중인 협업 없음"}</p>
          <p className="mt-2 text-[11px] leading-5 text-faint">요청 가능 여부는 상세 프로필에서 확인</p>
        </div>
        <Link id={"expert-profile-" + expert.user_id} href={href} className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[#20396f] px-3 text-[12px] font-bold text-white transition-colors hover:bg-[#34548c] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
          프로필 보기 <span aria-hidden="true" className="ml-1">→</span>
        </Link>
      </div>
    </article>
  );
}

function ExpertCard({ expert, names, interest, returnHref }: { expert: ExpertCardData; names: Names; interest: Interest | null; returnHref: string }) {
  const tags = [...expert.domain_ids.map((id) => names.fields.get(id) ?? id), ...expert.able_work_ids.map((id) => names.works.get(id) ?? id)];
  const { shown, rest } = headAndRest(tags, 3);
  const reason = interest ? expertReason(expert, interest, names) : null;
  const href = "/experts/" + expert.user_id + "?from=" + encodeURIComponent(returnHref);
  return (
    <article className="flex h-full flex-col rounded-2xl border border-[#e2e8f2] bg-white p-4 shadow-[0_4px_18px_rgba(18,32,75,0.035)] transition-[box-shadow,border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-[#b8c7e5] hover:shadow-[0_12px_25px_rgba(18,32,75,0.08)]">
      <div className="flex items-start gap-3">
        <ProfilePortrait expert={expert} />
        <div className="min-w-0 flex-1">
          <EngagementBadge engaged={expert.engaged} />
          <h3 className="mt-1.5 truncate text-[15px] font-bold text-ink">{expert.nickname}</h3>
          <p className="mt-0.5 line-clamp-2 text-[11px] leading-4 text-[#73809b]">
            {[expert.affiliation, expert.current_job ? JOB_LABELS[expert.current_job] : null].filter(Boolean).join(" · ") || "AI 전문가"}
          </p>
        </div>
      </div>
      <p className="mt-3 line-clamp-2 min-h-[40px] text-[12px] leading-5 text-muted">{expert.introduce || "프로필에서 연구 및 개발 경험을 확인해보세요."}</p>
      {reason && <p className="mt-2 line-clamp-1 text-[11px] font-semibold text-brand">{reason}</p>}
      <ul aria-label="전문 기술" className="mt-3 flex min-h-[25px] flex-wrap content-start gap-1.5">
        {shown.map((tag, i) => <li key={tag + i} className="rounded-md bg-[#f1f4fa] px-2 py-1 text-[10px] font-medium text-[#60759d]">{tag}</li>)}
        {rest > 0 && <li className="rounded-md bg-page px-2 py-1 text-[10px] text-muted">+{rest}</li>}
      </ul>
      <Link id={"expert-profile-" + expert.user_id} href={href} className="mt-auto inline-flex min-h-10 items-center justify-center rounded-lg border border-[#cbd5e7] bg-white px-3 pt-2 text-[12px] font-semibold text-[#263f79] transition-colors hover:border-[#7890cd] hover:bg-[#f4f7ff] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
        프로필 보기 <span aria-hidden="true" className="ml-1">→</span>
      </Link>
    </article>
  );
}

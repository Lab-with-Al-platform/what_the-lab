"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ExpertSearchHero } from "@/components/expert-search-hero";
import { PageContainer } from "@/components/page-container";
import { expertListHref, restoredExpertCount } from "@/lib/expert-search-navigation";
import { Avatar } from "@/components/request-parts";
import { ApiError, requestApi } from "@/lib/api";
import { photoOrDefault } from "@/lib/collab-requests";
import { buildNames, categoryNames, engagedLabel, headAndRest, splitTaxonomyIds, type ExpertCardData, type ExpertSearchResult, type Names } from "@/lib/expert-search";
import type { AbleWorkOption, CareerProfile, FieldCategory } from "@/lib/my-career";
import { DATA_STATUS_LABELS, type Research } from "@/lib/my-research";
import { expertReason, interestFromExpert, interestFromResearch, type Interest } from "@/lib/related-rank";

type Panel = "works" | "fields" | "research" | null;
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
  }, [incomingQuery, incomingWorksKey, incomingFieldsKey]);

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
      const params = new URLSearchParams({ q: query, works: works.join(","), fields: fields.join(","), offset: String(offset) });
      if (preferWorksKey) params.set("prefer_works", preferWorksKey);
      if (preferFieldsKey) params.set("prefer_fields", preferFieldsKey);
      return requestApi<ExpertSearchResult>(`/experts?${params}`);
    },
    [fields, preferFieldsKey, preferWorksKey, query, works],
  );

  // Returning from a profile restores the filters and previously expanded result pages (up to 60).
  const sameFilters = query === incomingQuery &&
    works.join(",") === incomingWorks.join(",") &&
    fields.join(",") === incomingFields.join(",");
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
  }

  const chips = [
    ...works.map((id) => ({ key: id, label: names.works.get(id) ?? id, remove: () => toggle(works, id, setWorks) })),
    ...fields.map((id) => ({ key: id, label: names.categories.get(id) ?? id, remove: () => toggle(fields, id, setFields) })),
  ];
  const matchedNames = result
    ? [...result.matched.able_work_ids.map((id) => names.works.get(id)), ...result.matched.field_ids.map((id) => names.fields.get(id))].filter(Boolean)
    : [];

  return (
    <PageContainer className="pb-20 pt-6 md:pt-8">
      <ExpertSearchHero>
        <form className="flex flex-col gap-2 rounded-2xl border border-[#b4a7ff]/55 bg-white/[0.1] p-1.5 shadow-[0_0_22px_rgba(115,84,242,0.18)] backdrop-blur-md focus-within:border-[#ddd5ff] focus-within:ring-2 focus-within:ring-[#b4a7ff]/30 sm:flex-row sm:items-center sm:rounded-full" onSubmit={onSearch}>
          <label className="sr-only" htmlFor="expert-query">찾고 싶은 AI 기술 또는 연구 분야</label>
          <div className="flex min-w-0 flex-1 items-center gap-3 px-3 sm:px-4">
            <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#dbdafa" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
              <circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>
            </svg>
            <input
              id="expert-query"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              maxLength={50}
              placeholder="예) LLM 기반 논문 요약, 의료 데이터 분석"
              className="h-11 min-w-0 w-full flex-1 bg-transparent text-sm text-white outline-none placeholder:text-[#c9ccec]"
            />
          </div>
          <button type="submit" className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#ab91ff] px-6 text-sm font-bold text-[#17113d] transition-colors hover:bg-[#c5b6ff] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:rounded-full">
            전문가 검색 <span aria-hidden="true">→</span>
          </button>
        </form>
      </ExpertSearchHero>

      <section className="rounded-b-[22px] border border-t-0 border-line bg-white px-4 pb-8 pt-7 shadow-[0_18px_42px_rgba(16,28,60,0.06)] sm:px-7 sm:pt-8 lg:px-9" aria-label="전문가 검색">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-[21px] font-bold tracking-tight text-ink sm:text-[24px]">전문가 탐색</h2>
          <span className="border-b-2 border-brand px-1 pb-2 text-sm font-semibold text-brand">전체 전문가</span>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2 border-b border-line pb-5">
          <PanelButton label="AI 기술" count={works.length} open={panel === "works"} onClick={() => setPanel(panel === "works" ? null : "works")} />
          <PanelButton label="연구 분야" count={fields.length} open={panel === "fields"} onClick={() => setPanel(panel === "fields" ? null : "fields")} />
          {role !== "expert" && (
            <button
              type="button"
              aria-expanded={panel === "research"}
              onClick={() => (applied ? clearAll() : setPanel(panel === "research" ? null : "research"))}
              className={`inline-flex min-h-10 items-center justify-center rounded-button border px-4 text-sm font-semibold transition-colors ${applied ? "border-brand bg-brand-soft text-brand" : "border-line bg-white text-ink hover:border-brand/50"}`}
            >
              {applied ? "내 연구 적용 중 ✕" : "내 연구로 찾기"}
            </button>
          )}
        </div>

        {panel === "works" && (
          <ChoicePanel title="무엇을 맡길까요?" options={ableWorks.map((item) => ({ id: item.able_work_id, label: item.name }))} selected={works} onToggle={(id) => toggle(works, id, setWorks)} />
        )}
        {panel === "fields" && (
          <ChoicePanel title="어떤 분야인가요?" options={categories.map((item) => ({ id: item.field_category_id, label: item.name }))} selected={fields} onToggle={(id) => toggle(fields, id, setFields)} />
        )}
        {panel === "research" && <ResearchPicker role={role} researches={researches} names={names} onPick={applyResearch} />}

        {chips.length > 0 && (
          <ul className="mt-3 flex flex-wrap items-center gap-2">
            {chips.map((chip) => (
              <li key={chip.key}>
                <button type="button" onClick={chip.remove} className="inline-flex min-h-9 items-center gap-1 rounded-full bg-brand-soft px-3 text-xs font-semibold text-brand">
                  {chip.label} <span aria-hidden="true">✕</span>
                  <span className="sr-only">조건 빼기</span>
                </button>
              </li>
            ))}
            <li>
              <button type="button" onClick={clearAll} className="min-h-9 px-2 text-xs text-muted underline-offset-2 hover:underline">
                전체 해제
              </button>
            </li>
          </ul>
        )}
        {applied && (
          <p className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-button bg-page px-4 py-3 text-xs text-muted">
            <span>
              내 연구 「{applied.title}」의 맡길 일과 분야로 찾고 있어요. 필터는 자유롭게 바꿀 수 있어요.
            </span>
            <button type="button" onClick={clearAll} className="font-semibold text-brand">
              해제
            </button>
          </p>
        )}
        {query && matchedNames.length > 0 && (
          <p className="mt-3 rounded-button bg-page px-4 py-3 text-xs text-muted">
            &lsquo;{query}&rsquo;는 &lsquo;{matchedNames.slice(0, 3).join("·")}{matchedNames.length > 3 ? " 등" : ""}&rsquo;과 같은 뜻으로 함께 찾았어요. 소개글에 &lsquo;{query}&rsquo;가 들어간 전문가도 포함돼요.
          </p>
        )}
      
      <div className="mt-7 flex flex-wrap items-end justify-between gap-2">
        <h2 className="text-lg font-bold">
          검색 결과 <span className="text-brand">{result ? `${result.total}명` : ""}</span>
        </h2>
        <p className="text-xs text-faint">
          {preferWorksKey || preferFieldsKey
            ? "나와 같은 키워드의 전문가를 위에 두었어요. 나머지 전문가도 이어서 보여요"
            : "새로 가입한 순 · 참여 중인 전문가는 뒤에 보여요"}
        </p>
      </div>

      <p className="mt-2 text-xs leading-5 text-muted">프로필에서 수행 경험과 협업 조건을 확인한 후 요청할 수 있어요.</p>
      {error && <p className="mt-4 text-sm text-danger" role="alert">{error}</p>}
      {!result ? (
        <p className="py-16 text-center text-sm text-faint">불러오는 중…</p>
      ) : result.items.length === 0 ? (
        <div className="mt-5 flex flex-col items-center rounded-2xl border border-dashed border-line bg-page px-5 py-12 text-center text-sm text-muted">
          <svg aria-hidden="true" width="35" height="35" viewBox="0 0 24 24" fill="none" stroke="#9993c7" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" className="mb-3"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4M8 11h6"/></svg>
          <strong className="text-base font-semibold text-ink">{chips.length > 0 || query ? "조건에 맞는 전문가가 없어요." : "아직 공개된 전문가가 없어요."}</strong>
          <p className="mt-2 text-xs leading-5 text-muted">{chips.length > 0 || query ? "검색어 또는 필터를 변경해서 다시 찾아보세요." : "AI 전문가가 프로필을 공개하면 이곳에 표시됩니다."}</p>
          {(chips.length > 0 || query) && (
            <button
              type="button"
              className="ml-2 font-semibold text-brand"
              onClick={() => {
                clearAll();
                setDraft("");
                setQuery("");
              }}
            >
              조건 지우기
            </button>
          )}
        </div>
      ) : (
        <>
          <ul className="mt-5 overflow-hidden rounded-2xl border border-line bg-white shadow-[0_2px_18px_rgba(16,28,60,0.035)]">
            {result.items.map((expert) => (
              <li key={expert.user_id} className="border-b border-line last:border-b-0">
                <ExpertCard expert={expert} names={names} interest={preferWorksKey || preferFieldsKey ? interest : null}
                  returnHref={expertListHref({ query, works, fields, shown: result.items.length, focus: expert.user_id, researchId: applied?.research_id })} />
              </li>
            ))}
          </ul>
          {result.items.length < result.total && (
            <div className="mt-8 text-center">
              <button type="button" onClick={loadMore} disabled={loadingMore} className="h-11 rounded-button border border-line bg-white px-6 text-sm font-semibold disabled:opacity-60">
                {loadingMore ? "불러오는 중…" : "전문가 더 보기"}
              </button>
            </div>
          )}
        </>
      )}
      </section>
    </PageContainer>
  );
}

function PanelButton({ label, count, open, onClick }: { label: string; count: number; open: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-expanded={open}
      onClick={onClick}
      className={`inline-flex h-11 items-center gap-2 rounded-button border px-3 text-sm ${open || count > 0 ? "border-brand text-brand" : "border-line bg-white"}`}
    >
      {label}
      {count > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-brand px-1 text-[11px] font-bold text-white">{count}</span>}
      <span aria-hidden="true">{open ? "▴" : "▾"}</span>
    </button>
  );
}

function ChoicePanel({ title, options, selected, onToggle }: { title: string; options: { id: string; label: string }[]; selected: string[]; onToggle: (id: string) => void }) {
  return (
    <div className="mt-3 rounded-card border border-line bg-page p-4">
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-0.5 text-xs text-muted">여러 개 고를 수 있어요. 고르면 아래 목록에 바로 반영돼요.</p>
      <ul className="mt-3 flex flex-wrap gap-2">
        {options.map((option) => {
          const on = selected.includes(option.id);
          return (
            <li key={option.id}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => onToggle(option.id)}
                className={`min-h-10 rounded-full px-3 text-sm ${on ? "bg-brand text-white" : "border border-line bg-white"}`}
              >
                {option.label}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** [내 연구로 찾기]: 등록한 연구를 고르면 그 연구의 맡길 일·분야로 필터를 채워요. */
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

function ExpertCard({ expert, names, interest, returnHref }: { expert: ExpertCardData; names: Names; interest: Interest | null; returnHref: string }) {
  const tags = [...expert.domain_ids.map((id) => names.fields.get(id) ?? id), ...expert.able_work_ids.map((id) => names.works.get(id) ?? id)];
  const { shown, rest } = headAndRest(tags);
  const engaged = engagedLabel(expert);
  const reason = interest ? expertReason(expert, interest, names) : null;
  const detailUrl = `/experts/${expert.user_id}?from=${encodeURIComponent(returnHref)}`;

  return (
    <article className="group flex flex-col gap-4 bg-white px-4 py-4 transition-colors hover:bg-[#faf9ff] sm:flex-row sm:items-center sm:gap-5 sm:px-5 sm:py-5">
      <div className="flex min-w-0 flex-1 items-start gap-4">
        <div className="shrink-0 rounded-full bg-page p-0.5">
          <Avatar src={photoOrDefault(expert.user_photo, "expert")} size={52} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h3 className="text-[16px] font-bold tracking-tight text-ink">{expert.nickname}</h3>
            {engaged && <span className="rounded-full bg-trend-soft px-2 py-1 text-[11px] font-semibold text-trend">{engaged}</span>}
          </div>
          {reason && <p className="mt-1.5 text-xs font-semibold text-brand">{reason}</p>}
          <p className="mt-1.5 line-clamp-2 text-[13px] leading-5 text-muted">{expert.introduce || "아직 소개를 적지 않았어요"}</p>
          <ul className="mt-2.5 flex flex-wrap gap-1.5" aria-label="전문 분야 및 수행 기술">
            {shown.map((tag) => (
              <li key={tag} className="rounded-full bg-brand-soft px-2.5 py-1 text-xs font-medium text-brand">{tag}</li>
            ))}
            {rest > 0 && <li className="rounded-full bg-page px-2.5 py-1 text-xs text-muted">+{rest}</li>}
          </ul>
        </div>
      </div>
      <Link
        id={`expert-profile-${expert.user_id}`}
        href={detailUrl}
        className="inline-flex min-h-11 w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-brand px-4 text-[13px] font-semibold text-white shadow-[0_5px_13px_rgba(80,54,244,0.15)] transition-colors hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand sm:w-[175px]"
      >
        프로필 자세히 보기 <span aria-hidden="true">→</span>
      </Link>
    </article>
  );
}

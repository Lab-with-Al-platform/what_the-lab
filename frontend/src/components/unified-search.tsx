"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { InsightCard } from "@/components/insight-card";
import { PageContainer } from "@/components/page-container";
import { ApiError, requestApi } from "@/lib/api";
import { CATEGORIES, communityApi, type CommunityPost, type PostList } from "@/lib/community";
import { FAQ_CATEGORIES, type Faq } from "@/lib/faq";
import { GLOBAL_SEARCH_MAX_LENGTH, GLOBAL_SEARCH_PREVIEW_SIZE, globalSearchSourceHref } from "@/lib/global-search";
import type { InsightListItem } from "@/lib/insight-meta";
import type { ExpertCardData, ExpertSearchResult } from "@/lib/expert-search";

type Remote<T> = { items: T[]; total: number; loading: boolean; error: string };
const blank = <T,>(): Remote<T> => ({ items: [], total: 0, loading: true, error: "" });
const PREVIEW_INSIGHTS = 4;
const PREVIEW_FAQS = 4;

function SearchArrow() {
  return <span aria-hidden="true" className="text-lg leading-none">↗</span>;
}

function SectionHeading({ number, title, description, count, anchor }: {
  number: string; title: string; description: string; count: string; anchor: string;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b border-[#e3e9f4] pb-5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl border border-[#dce5f4] bg-[#f4f7fd] text-[12px] font-extrabold text-[#4b65a1]">{number}</span>
        <div>
          <h2 id={anchor + "-heading"} className="text-xl font-extrabold tracking-[-0.035em] text-[#172a4f] sm:text-[23px]">{title}</h2>
          <p className="mt-1 text-[12px] leading-5 text-[#73819b]">{description}</p>
        </div>
      </div>
      <span className="rounded-full bg-[#f0f4fa] px-3 py-1.5 text-[11px] font-bold text-[#536789]" aria-live="polite">{count}</span>
    </div>
  );
}

function NoMatches({ label, href }: { label: string; href: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-[#d9e2ee] bg-[#fafcff] px-5 py-9 text-center">
      <p className="text-sm font-semibold text-[#52637f]">관련 {label} 결과가 없습니다.</p>
      <Link href={href} className="mt-2 inline-flex min-h-10 items-center text-xs font-bold text-[#3d5aab] hover:underline">
        {label} 전체 둘러보기 <span aria-hidden="true" className="ml-1">→</span>
      </Link>
    </div>
  );
}

function RemoteError({ message, retry, source }: { message: string; retry: () => void; source: string }) {
  return (
    <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#f0dacf] bg-[#fff9f5] p-5">
      <p className="text-[13px] leading-6 text-[#845a45]">{source} 검색을 완료하지 못했어요. {message}</p>
      <button type="button" onClick={retry} className="min-h-10 rounded-lg border border-[#d4b6a6] bg-white px-4 text-xs font-bold text-[#81513c] hover:bg-[#fff0e9]">다시 시도</button>
    </div>
  );
}

function SkeletonCards() {
  return (
    <div aria-live="polite" role="status" className="grid gap-3 sm:grid-cols-2">
      <span className="sr-only">검색 결과를 불러오는 중입니다.</span>
      {[1, 2].map((id) => (
        <div key={id} aria-hidden="true" className="animate-pulse rounded-2xl border border-[#e4eaf4] bg-white p-5">
          <div className="h-3 w-20 rounded bg-[#e9edf5]" />
          <div className="mt-4 h-5 w-3/4 rounded bg-[#e9edf5]" />
          <div className="mt-3 h-3 w-full rounded bg-[#f0f3f8]" />
          <div className="mt-2 h-3 w-2/3 rounded bg-[#f0f3f8]" />
        </div>
      ))}
    </div>
  );
}

export function UnifiedSearch({ query, insights, faqs }: {
  query: string;
  insights: InsightListItem[];
  faqs: Faq[];
}) {
  const [experts, setExperts] = useState<Remote<ExpertCardData>>(blank);
  const [posts, setPosts] = useState<Remote<CommunityPost>>(blank);
  const [retryKey, setRetryKey] = useState(0);
  const [allInsights, setAllInsights] = useState(false);
  const [allFaqs, setAllFaqs] = useState(false);

  useEffect(() => {
    if (!query) return;
    const controller = new AbortController();
    setExperts(blank());
    setPosts(blank());
    const params = new URLSearchParams({ q: query, offset: "0" });
    const communityParams = new URLSearchParams({
      scope: "public", q: query, page: "1", page_size: String(GLOBAL_SEARCH_PREVIEW_SIZE), order: "latest",
    });

    // Each source fails independently. Never expose member-only/community moderation scopes.
    const expertRequest = requestApi<ExpertSearchResult>("/experts?" + params.toString(), { signal: controller.signal })
      .then((result) => {
        if (!controller.signal.aborted) setExperts({ items: result.items, total: result.total, loading: false, error: "" });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setExperts({ items: [], total: 0, loading: false,
          error: error instanceof ApiError ? error.message : "네트워크 연결을 확인해 주세요." });
      });
    const communityRequest = communityApi<PostList>("/posts?" + communityParams.toString(), { signal: controller.signal })
      .then((result) => {
        if (!controller.signal.aborted) setPosts({ items: result.items.filter((item) => item.visibility === "public" && !item.hidden),
          total: result.total, loading: false, error: "" });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setPosts({ items: [], total: 0, loading: false,
          error: error instanceof ApiError ? error.message : "네트워크 연결을 확인해 주세요." });
      });

    // A stalled upstream must not leave an endless loading indicator.
    const timeout = window.setTimeout(() => {
      setExperts((prev) => prev.loading ? { ...prev, loading: false, error: "응답 시간이 초과되었습니다." } : prev);
      setPosts((prev) => prev.loading ? { ...prev, loading: false, error: "응답 시간이 초과되었습니다." } : prev);
      controller.abort();
    }, 16000);
    void Promise.allSettled([expertRequest, communityRequest]).finally(() => window.clearTimeout(timeout));
    return () => { window.clearTimeout(timeout); controller.abort(); };
  }, [query, retryKey]);

  const expertHref = globalSearchSourceHref("experts", query);
  const boardHref = globalSearchSourceHref("community", query);
  const faqHref = globalSearchSourceHref("faq", query);
  const ready = !experts.loading && !posts.loading;
  const totalKnown = insights.length + faqs.length + (experts.error ? 0 : experts.total) + (posts.error ? 0 : posts.total);
  const allEmpty = ready && !experts.error && !posts.error && totalKnown === 0;
  const count = (value: Remote<unknown>) => !query ? "검색어 대기" : value.loading ? "검색 중" : value.error ? "조회 오류" : value.total + "건";
  const sections = [
    { id: "insights", label: "인사이트", number: String(insights.length) },
    { id: "experts", label: "전문가", number: count(experts) },
    { id: "community", label: "자유게시판", number: count(posts) },
    { id: "faq", label: "FAQ", number: String(faqs.length) },
  ];

  return (
    <div className="min-h-[80vh] bg-[#f7f9fd] pb-24">
      <div className="relative overflow-hidden bg-[#10264e] text-white">
        <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-40 size-[440px] rounded-full bg-[#2f65bb]/20 blur-[90px]" />
        <div aria-hidden="true" className="pointer-events-none absolute bottom-[-140px] left-[20%] size-[350px] rounded-full bg-[#33a9b0]/10 blur-[85px]" />
        <PageContainer className="relative pb-11 pt-9 sm:pb-14 sm:pt-12">
          <nav aria-label="현재 위치" className="flex items-center gap-2 text-xs text-[#a8bad6]">
            <Link href="/" className="hover:text-white">홈</Link>
            <span aria-hidden="true">›</span><span aria-current="page" className="text-[#d7e6ff]">통합검색</span>
          </nav>
          <p className="mt-9 text-[11px] font-bold uppercase tracking-[0.23em] text-[#86c9df]">DISCOVER WHAT MATTERS</p>
          <h1 className="mt-3 text-[32px] font-extrabold tracking-[-0.05em] sm:text-[45px]">
            하나의 검색으로, <span className="text-[#a9d8e7]">연구의 다음 단계까지.</span>
          </h1>
          <p className="mt-3 max-w-2xl text-[13px] leading-7 text-[#b7c7df] sm:text-sm">
            인사이트에서 아이디어를 발견하고, 전문가와 연결되고, 커뮤니티의 경험과 답변을 찾아보세요.
          </p>
          <form action="/search" role="search" className="mt-7 flex max-w-3xl flex-col gap-2 rounded-2xl bg-white p-2 shadow-[0_18px_45px_rgba(6,16,39,0.2)] sm:flex-row sm:items-center">
            <label htmlFor="global-query" className="sr-only">인사이트, 전문가, 게시글, FAQ 통합검색</label>
            <div className="flex min-w-0 flex-1 items-center gap-3 px-3">
              <svg aria-hidden="true" width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#647896" strokeWidth="1.8"><circle cx="10.8" cy="10.8" r="7.2"/><path d="m16.3 16.3 4.3 4.3"/></svg>
              <input id="global-query" name="q" type="search" defaultValue={query} maxLength={GLOBAL_SEARCH_MAX_LENGTH}
                placeholder="예: RAG, 의료영상, 연구 협업" className="h-12 min-w-0 w-full bg-transparent text-[14px] font-medium text-[#1d3454] outline-none placeholder:font-normal placeholder:text-[#8b99af]" />
            </div>
            <button type="submit" className="min-h-11 rounded-xl bg-[#345bc1] px-8 text-[13px] font-bold text-white transition-colors hover:bg-[#294aa5] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#85baf4]">통합검색 <span aria-hidden="true">→</span></button>
          </form>
          <p className="mt-3 text-xs text-[#afbfda]">공개된 콘텐츠만 검색하며, 비공개 연구·문의와 개인 정보는 표시하지 않습니다.</p>
        </PageContainer>
      </div>

      <PageContainer className="pt-7 sm:pt-9">
        {query ? (
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold tracking-[0.16em] text-[#6881a7]">SEARCH RESULTS</p>
              <h2 className="mt-1 text-lg font-extrabold text-[#192d51] sm:text-[23px]">
                ‘{query}’ <span className="font-medium text-[#62748f]">통합검색 결과</span>
              </h2>
            </div>
            <p role="status" className="text-[12px] font-semibold text-[#62738e]">
              {ready ? experts.error || posts.error ? "일부 검색 결과를 불러오지 못했습니다." : "전체 " + totalKnown + "건" : "검색 결과를 확인하는 중입니다…"}
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-[#e0e8f3] bg-white px-5 py-7 sm:px-8">
            <p className="text-sm font-extrabold text-[#213c69]">무엇을 찾고 계신가요?</p>
            <p className="mt-2 text-[13px] leading-6 text-[#74819a]">검색어를 입력하면 네 영역을 한 번에 확인할 수 있어요. 원하는 콘텐츠로 바로 이동할 수도 있습니다.</p>
          </div>
        )}

        <nav aria-label="검색 결과 유형 바로가기" className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {sections.map((section, index) => (
            <a key={section.id} href={"#" + section.id}
              className="group flex min-h-16 items-center justify-between gap-2 rounded-xl border border-[#e0e7f2] bg-white px-3 py-3 shadow-[0_3px_12px_rgba(32,54,94,0.025)] transition-colors hover:border-[#afc2e9] hover:bg-[#fafdff] sm:px-4">
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-[#8999b7]">{"0" + (index + 1)} · {section.number}</p>
                <p className="mt-1 text-[12px] font-extrabold text-[#2d456e] sm:text-[13px]">{section.label}</p>
              </div>
              <span aria-hidden="true" className="text-[#92a5c3] group-hover:text-[#345bc1]">↘</span>
            </a>
          ))}
        </nav>

        {allEmpty && <div role="status" className="mt-8 rounded-2xl border border-[#dce4f0] bg-white p-8 text-center">
          <p className="text-lg font-extrabold text-[#263d62]">일치하는 검색 결과가 없어요.</p>
          <p className="mt-2 text-sm leading-6 text-[#71819a]">짧은 단어나 다른 표현으로 검색해 보세요. 띄어쓰기를 바꾸는 것도 도움이 됩니다.</p>
        </div>}

        <div className="space-y-12 pt-10 sm:space-y-14">
          <section id="insights" aria-labelledby="insights-heading" className="scroll-mt-28">
            <SectionHeading number="01" title="관련 인사이트" description="AI 연구 협업 사례와 AI 트렌드 · 현재 공개 목록 기준" count={insights.length + "건"} anchor="insights" />
            {!query ? (
              <p className="rounded-xl bg-white p-6 text-sm text-[#74819a]">검색어를 입력하면 관련 인사이트가 표시됩니다.</p>
            ) : insights.length ? (
              <>
                <div className="grid items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  {insights.slice(0, allInsights ? undefined : PREVIEW_INSIGHTS).map((item) => (
                    <InsightCard key={item.kind + item.slug} article={item} variant="editorial" />
                  ))}
                </div>
                {insights.length > PREVIEW_INSIGHTS && (
                  <button type="button" onClick={() => setAllInsights((value) => !value)}
                    className="mt-4 flex min-h-11 w-full items-center justify-center rounded-xl border border-[#d6e1f1] bg-white px-4 text-[12px] font-bold text-[#3f5d95] hover:bg-[#f2f6ff]">
                    {allInsights ? "인사이트 접기" : "관련 인사이트 " + (insights.length - PREVIEW_INSIGHTS) + "건 더 보기"} <span className="ml-2" aria-hidden="true">{allInsights ? "↑" : "↓"}</span>
                  </button>
                )}
              </>
            ) : <NoMatches label="인사이트" href="/cases" />}
          </section>

          <section id="experts" aria-labelledby="experts-heading" className="scroll-mt-28">
            <SectionHeading number="02" title="관련 전문가 찾기" description="공개 프로필을 기준으로 이름·소개·수행 기술·연구 분야 검색" count={count(experts)} anchor="experts" />
            {!query ? <p className="rounded-xl bg-white p-6 text-sm text-[#74819a]">검색어를 입력하면 관련 전문가가 표시됩니다.</p>
              : experts.loading ? <SkeletonCards />
              : experts.error ? <RemoteError message={experts.error} source="전문가" retry={() => setRetryKey((n) => n + 1)} />
              : experts.items.length ? (
                <>
                  <div className="grid gap-3 md:grid-cols-2">
                    {experts.items.map((person) => (
                      <Link key={person.user_id} href={"/experts/" + person.user_id}
                        className="group flex min-w-0 flex-col justify-between rounded-2xl border border-[#dfe7f1] bg-white p-5 shadow-[0_4px_18px_rgba(25,48,92,0.03)] transition-all hover:-translate-y-0.5 hover:border-[#a9bee4] hover:shadow-[0_10px_25px_rgba(25,48,92,0.06)]">
                        <div>
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-[10px] font-bold tracking-[0.08em] text-[#3e6aab]">AI EXPERT</span>
                            <span className="text-[10px] text-[#7586a0]">{person.engaged ? "현재 협업 중" : "진행 중 협업 없음"}</span>
                          </div>
                          <h3 className="mt-2 text-[17px] font-extrabold text-[#1d3457] group-hover:text-[#365bb6]">{person.nickname}</h3>
                          <p className="mt-1 text-[12px] text-[#6c7c98]">{person.affiliation || "소속 미등록"}</p>
                          <p className="mt-3 line-clamp-2 text-[13px] leading-6 text-[#556781]">{person.introduce || "공개 프로필에서 기술 및 연구 경험을 확인해 보세요."}</p>
                        </div>
                        <p className="mt-4 flex items-center justify-between border-t border-[#edf0f6] pt-3 text-[12px] font-bold text-[#3e60a5]">전문가 프로필 보기 <SearchArrow /></p>
                      </Link>
                    ))}
                  </div>
                  <Link href={expertHref} className="mt-3 inline-flex min-h-11 items-center text-[12px] font-bold text-[#3e5fa5] hover:underline">
                    전문가 찾기에서 {experts.total > experts.items.length ? "전체 " + experts.total + "명" : "더 자세히"} 보기 <span aria-hidden="true" className="ml-2">→</span>
                  </Link>
                </>
              ) : <NoMatches label="전문가" href={expertHref} />}
          </section>

          <section id="community" aria-labelledby="community-heading" className="scroll-mt-28">
            <SectionHeading number="03" title="관련 자유게시판" description="공개 게시글의 제목과 본문 검색 · 비공개 문의 제외" count={count(posts)} anchor="community" />
            {!query ? <p className="rounded-xl bg-white p-6 text-sm text-[#74819a]">검색어를 입력하면 공개 게시글이 표시됩니다.</p>
              : posts.loading ? <SkeletonCards />
              : posts.error ? <RemoteError message={posts.error} source="자유게시판" retry={() => setRetryKey((n) => n + 1)} />
              : posts.items.length ? (
                <>
                  <div className="grid gap-3 md:grid-cols-2">
                    {posts.items.map((post) => (
                      <Link key={post.id} href={"/community/" + post.id}
                        className="group flex flex-col justify-between rounded-2xl border border-[#dfe7f1] bg-white p-5 transition-colors hover:border-[#a9bee4] hover:bg-[#fcfdff]">
                        <div>
                          <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold text-[#70809c]">
                            <span className="rounded-md bg-[#f1f4fc] px-2 py-1 text-[#526baa]">{CATEGORIES[post.category] || "게시글"}</span>
                            <span>{post.created_at.slice(0, 10)}</span><span>댓글 {post.reply_count}개</span>
                          </div>
                          <h3 className="mt-3 line-clamp-2 text-[15px] font-extrabold text-[#253959] group-hover:text-[#365bb6]">{post.title}</h3>
                          <p className="mt-2 line-clamp-2 text-[12px] leading-6 text-[#677791]">{post.excerpt}</p>
                        </div>
                        <p className="mt-4 flex items-center justify-between border-t border-[#edf0f6] pt-3 text-[12px] font-bold text-[#3e60a5]">게시글 읽기 <SearchArrow /></p>
                      </Link>
                    ))}
                  </div>
                  <Link href={boardHref} className="mt-3 inline-flex min-h-11 items-center text-[12px] font-bold text-[#3e5fa5] hover:underline">
                    자유게시판에서 {posts.total > posts.items.length ? "전체 " + posts.total + "건" : "더 자세히"} 보기 <span aria-hidden="true" className="ml-2">→</span>
                  </Link>
                </>
              ) : <NoMatches label="자유게시판" href={boardHref} />}
          </section>

          <section id="faq" aria-labelledby="faq-heading" className="scroll-mt-28">
            <SectionHeading number="04" title="관련 FAQ" description="실제 자주 묻는 질문과 답변·키워드 검색" count={faqs.length + "건"} anchor="faq" />
            {!query ? (
              <p className="rounded-xl bg-white p-6 text-sm text-[#74819a]">검색어를 입력하면 관련 FAQ가 표시됩니다.</p>
            ) : faqs.length ? (
              <>
                <div className="grid gap-3 md:grid-cols-2">
                  {faqs.slice(0, allFaqs ? undefined : PREVIEW_FAQS).map((faq) => (
                    <Link key={faq.id} href={"/faq#" + encodeURIComponent(faq.id)}
                      className="group flex flex-col rounded-2xl border border-[#dfe7f1] bg-white p-5 transition-colors hover:border-[#a9bee4]">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-bold tracking-[0.08em] text-[#527db7]">Q&A · {FAQ_CATEGORIES[faq.category]}</span>
                        <span aria-hidden="true" className="text-[#91a5c5]">↗</span>
                      </div>
                      <h3 className="mt-3 text-[14px] font-extrabold leading-6 text-[#263b5d] group-hover:text-[#365bb6]">{faq.question}</h3>
                      <p className="mt-2 line-clamp-3 text-[12px] leading-6 text-[#687993]">{faq.answer[0]}</p>
                    </Link>
                  ))}
                </div>
                {faqs.length > PREVIEW_FAQS && (
                  <button type="button" onClick={() => setAllFaqs((value) => !value)}
                    className="mt-4 flex min-h-11 w-full items-center justify-center rounded-xl border border-[#d6e1f1] bg-white px-4 text-[12px] font-bold text-[#3f5d95] hover:bg-[#f2f6ff]">
                    {allFaqs ? "FAQ 접기" : "관련 FAQ " + (faqs.length - PREVIEW_FAQS) + "건 더 보기"}
                  </button>
                )}
                <Link href={faqHref} className="mt-3 inline-flex min-h-11 items-center text-[12px] font-bold text-[#3e5fa5] hover:underline">FAQ에서 검색 결과 보기 <span aria-hidden="true" className="ml-2">→</span></Link>
              </>
            ) : <NoMatches label="FAQ" href="/faq" />}
          </section>
        </div>

        <div className="mt-14 rounded-2xl border border-[#dce6f3] bg-white px-6 py-6 sm:px-8">
          <p className="text-[11px] font-bold tracking-[0.14em] text-[#8093b2]">RESEARCH · CONNECT · DISCOVER</p>
          <p className="mt-2 text-[15px] font-extrabold text-[#213a64]">원하는 결과가 없나요?</p>
          <p className="mt-2 text-[12px] leading-6 text-[#70809a]">검색어를 간결하게 바꾸거나 개별 메뉴의 상세 필터를 활용해 보세요. 전문가에게 협업을 요청하려면 프로필에서 조건을 확인해야 합니다.</p>
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
            <Link href="/cases" className="text-xs font-bold text-[#3d60a4] hover:underline">인사이트 둘러보기 →</Link>
            <Link href="/experts" className="text-xs font-bold text-[#3d60a4] hover:underline">전문가 찾기 →</Link>
            <Link href="/community" className="text-xs font-bold text-[#3d60a4] hover:underline">자유게시판 →</Link>
            <Link href="/faq" className="text-xs font-bold text-[#3d60a4] hover:underline">FAQ →</Link>
          </div>
        </div>
      </PageContainer>
    </div>
  );
}

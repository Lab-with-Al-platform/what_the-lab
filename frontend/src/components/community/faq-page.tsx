"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { PageContainer } from "@/components/page-container";
import { FAQ_CATEGORIES, FAQS, searchFaqs, type FaqCategory } from "@/lib/faq";
import { FaqWalkthrough } from "./faq-walkthrough";
import { Icon } from "./community-ui";
import communityStyles from "./community.module.css";
import styles from "./faq-visual.module.css";

const QUICK_HELP = [
  { label: "협업 요청과 작업 요청", id: "workspace-task-vs-request" },
  { label: "협업 일정·달력", id: "workspace-schedules" },
  { label: "협업 종료 후 평가", id: "review-after-completion" },
] as const;

const categoryEntries = Object.entries(FAQ_CATEGORIES) as [FaqCategory, string][];

function getHashFaqId() {
  if (typeof window === "undefined") return "";
  try { return decodeURIComponent(window.location.hash.slice(1)); }
  catch { return ""; }
}

export function FaqPage() {
  const params = useSearchParams();
  const router = useRouter();
  const query = params.get("q") ?? "";
  const rawCategory = params.get("category") ?? "all";
  const category = rawCategory in FAQ_CATEGORIES ? rawCategory : "all";
  const [expanded, setExpanded] = useState("");
  const [copyMessage, setCopyMessage] = useState("");
  const refs = useRef<Record<string, HTMLDetailsElement | null>>({});
  const results = useMemo(() => searchFaqs(query, category), [query, category]);

  useEffect(() => {
    function openHash() {
      const id = getHashFaqId();
      if (!FAQS.some((faq) => faq.id === id)) return;
      if (!results.some((faq) => faq.id === id)) {
        // A direct FAQ link must work even when the current search/filter hides it.
        router.replace(`/faq#${encodeURIComponent(id)}`, { scroll: false });
        return;
      }
      setExpanded(id);
      window.requestAnimationFrame(() => refs.current[id]?.scrollIntoView({ block: "start" }));
    }
    openHash();
    window.addEventListener("hashchange", openHash);
    return () => window.removeEventListener("hashchange", openHash);
  }, [results, router]);

  function filter(next: { q?: string; category?: string }) {
    const search = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value && value !== "all") search.set(key, value);
      else search.delete(key);
    }
    router.replace(`/faq${search.size ? `?${search.toString()}` : ""}`, { scroll: false });
  }

  async function copyFaqLink(id: string) {
    const url = new URL(`/faq#${encodeURIComponent(id)}`, window.location.origin).href;
    try {
      await navigator.clipboard.writeText(url);
      setCopyMessage("해당 FAQ 주소를 복사했습니다.");
    } catch {
      setCopyMessage(`복사가 제한되어 있어요. 이 주소를 복사해 주세요: ${url}`);
    }
  }

  return (
    <PageContainer className={communityStyles.page}>
      <div className={communityStyles.breadcrumb}>
        <Link href="/">홈</Link><span>›</span><span>FAQ</span>
      </div>

      <div className={styles.shell}>
        <header className={styles.hero}>
          <div className={styles.heroEyebrow}>WHAT THE LAB / HELP CENTER</div>
          <h1>궁금한 순간, 바로 찾는 답.</h1>
          <p>처음 이용하는 방법부터 협업 요청, 함께 쓰는 달력과 할 일, 종료 후 평가까지. 실제 서비스 흐름에 맞춰 안내합니다.</p>
          <div className={styles.heroSearch}>
            <Icon name="search" />
            <label className="sr-only" htmlFor="faq-search">FAQ 검색</label>
            <input
              id="faq-search"
              type="search"
              value={query}
              onChange={event => filter({ q: event.target.value })}
              placeholder="예: 일정 추가, 기한 조정, 평가, 비공개 문의"
              maxLength={200}
            />
            {query ? (
              <button type="button" aria-label="검색어 지우기" onClick={() => filter({ q: "" })}>지우기</button>
            ) : <span aria-hidden="true" className="text-[11px] font-semibold text-[#a0aec4]">FAQ</span>}
          </div>
          <nav aria-label="자주 찾는 도움말" className={styles.heroShortcuts}>
            <span>바로 보기</span>
            {QUICK_HELP.map(item => (
              <Link href={`/faq#${item.id}`} key={item.id}>{item.label}</Link>
            ))}
          </nav>
        </header>

        <div className={styles.overview}>
          <div className={styles.overviewText}>
            <span aria-hidden="true" className={styles.overviewIcon}>✦</span>
            실제 메뉴와 버튼을 기준으로 작성한 도움말
          </div>
          <small>서비스 기능 안내 기준 · 2026.11.03</small>
        </div>

        <div className={styles.layout}>
          <nav className={styles.side} aria-label="FAQ 분류">
            <span className={styles.sideCaption}>EXPLORE TOPICS</span>
            <button type="button" className={styles.sideButton} aria-pressed={category === "all"} onClick={() => filter({ category: "all" })}>
              <span>전체 도움말</span><span>{FAQS.length}</span>
            </button>
            {categoryEntries.map(([id, label]) => (
              <button type="button" key={id} className={styles.sideButton} aria-pressed={category === id} onClick={() => filter({ category: id })}>
                <span>{label}</span><span>{FAQS.filter(faq => faq.category === id).length}</span>
              </button>
            ))}
          </nav>

          <main>
            <div className={styles.sectionHeader}>
              <div>
                <h2>{category === "all" ? "전체 도움말" : FAQ_CATEGORIES[category as FaqCategory]}</h2>
                <p>{query ? `‘${query}’ 검색 결과` : "필요한 질문을 누르면 답변과 화면 안내를 확인할 수 있어요."}</p>
              </div>
              <span className={styles.resultCount} role="status">{results.length}개 질문</span>
            </div>
            <div className={styles.accordion}>
              {results.map((faq, index) => (
                <details
                  id={faq.id}
                  key={faq.id}
                  className={styles.item}
                  ref={node => { refs.current[faq.id] = node; }}
                  open={expanded === faq.id}
                >
                  <summary
                    className={styles.question}
                    onClick={event => {
                      event.preventDefault();
                      setExpanded(current => current === faq.id ? "" : faq.id);
                    }}
                  >
                    <span aria-hidden="true" className={styles.questionNumber}>{String(index + 1).padStart(2, "0")}</span>
                    <span className={styles.questionText}>{faq.question}</span>
                    {faq.guide && <span className={styles.guidePill}>단계별 안내</span>}
                    <span aria-hidden="true" className={styles.expand}>{expanded === faq.id ? "−" : "+"}</span>
                  </summary>

                  <div className={styles.answer}>
                    {faq.answer.map((paragraph, paragraphIndex) => (
                      <p key={paragraphIndex}>{paragraph}</p>
                    ))}
                    {faq.guide && expanded === faq.id && <FaqWalkthrough key={faq.id} faqId={faq.id} guide={faq.guide} />}
                    <div className={styles.actions}>
                      {faq.links.map(link => (
                        <Link key={link.href} href={link.href}>{link.label}<Icon name="arrow" size={13} /></Link>
                      ))}
                      <button type="button" className={styles.copy} onClick={() => void copyFaqLink(faq.id)}>답변 링크 복사</button>
                    </div>
                  </div>
                </details>
              ))}
              {results.length === 0 && (
                <div className={styles.empty}>
                  <h3>다른 표현으로 찾아볼까요?</h3>
                  <p>기능 이름을 짧게 검색하거나 전체 도움말로 돌아가 보세요.</p>
                  <button type="button" onClick={() => router.replace("/faq", { scroll: false })}>검색 초기화</button>
                </div>
              )}
            </div>
            {copyMessage && <p className={styles.copyStatus} role="status">{copyMessage}</p>}

            <section className={styles.cta} aria-label="추가 문의">
              <div>
                <h2>그래도 해결되지 않았나요?</h2>
                <p>함께 나눌 질문은 공개 게시판에, 계정이나 개인적인 문제는 비공개 문의로 남겨 주세요.</p>
              </div>
              <div className={styles.ctaActions}>
                <Link href="/community/new?category=question">질문 작성하기</Link>
                <Link href="/community/new?visibility=private&category=support">비공개 문의</Link>
              </div>
            </section>
          </main>
        </div>
      </div>
    </PageContainer>
  );
}

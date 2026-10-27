"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { PageContainer } from "@/components/page-container";
import { FAQ_CATEGORIES, FAQS, searchFaqs } from "@/lib/faq";
import { Icon } from "./community-ui";
import styles from "./community.module.css";

export function FaqPage() {
  const params = useSearchParams();
  const router = useRouter();
  const query = params.get("q") ?? "";
  const category = params.get("category") ?? "all";
  const [expanded, setExpanded] = useState("");
  const [copyMessage, setCopyMessage] = useState("");
  const refs = useRef<Record<string, HTMLDetailsElement | null>>({});
  const results = searchFaqs(query, category);
  useEffect(() => {
    function openHash() {
      const id = window.location.hash.slice(1);
      if (!FAQS.some((item) => item.id === id)) return;
      const element = refs.current[id];
      if (element) {
        element.open = true;
        setExpanded(id);
        element.scrollIntoView({ block: "start" });
      }
    }
    openHash();
    window.addEventListener("hashchange", openHash);
    return () => window.removeEventListener("hashchange", openHash);
  }, [query, category]);
  function filter(next: { q?: string; category?: string }) {
    const p = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value && value !== "all") p.set(key, value);
      else p.delete(key);
    }
    router.replace(`/faq${p.size ? `?${p}` : ""}`, { scroll: false });
  }
  return (
    <PageContainer className={styles.page}>
      <div className={styles.breadcrumb}>
        <Link href="/">홈</Link>
        <span>›</span>
        <span>FAQ</span>
      </div>
      <header className={styles.faqHero}>
        <p className={styles.eyebrow}>HELP & GUIDANCE</p>
        <h1>무엇이 궁금하신가요?</h1>
        <p>
          처음 방문했을 때도, 이용하다 막혔을 때도.
          <br />
          자주 묻는 질문에서 필요한 답을 찾아보세요.
        </p>
        <div className={styles.search} style={{ textAlign: "left" }}>
          <Icon name="search" />
          <label className="sr-only" htmlFor="faq-search">
            도움말 검색
          </label>
          <input
            id="faq-search"
            value={query}
            onChange={(e) => filter({ q: e.target.value })}
            placeholder="예: 비공개 문의, 전문가, 연구 데이터"
            maxLength={200}
          />
          {query && (
            <button
              onClick={() => filter({ q: "" })}
              aria-label="검색어 지우기"
            >
              ×
            </button>
          )}
        </div>
        <p
          className={styles.meta}
          style={{ marginTop: 12, justifyContent: "center", marginBottom: 0 }}
        >
          자주 찾는 질문{" "}
          <Link
            href="/faq#private-post"
            onClick={() => setExpanded("private-post")}
            style={{ color: "var(--color-brand)" }}
          >
            비공개 문의
          </Link>
          <span>·</span>
          <Link
            href="/faq#first-question"
            onClick={() => setExpanded("first-question")}
            style={{ color: "var(--color-brand)" }}
          >
            첫 질문
          </Link>
        </p>
      </header>
      <div className={styles.faqMain}>
        <div className={styles.faqLayout}>
          <nav aria-label="FAQ 분류">
            <button
              className={`${styles.sideLink} ${category === "all" ? styles.sideActive : ""}`}
              aria-pressed={category === "all"}
              onClick={() => filter({ category: "all" })}
            >
              전체 도움말 <span>{FAQS.length}</span>
            </button>
            {Object.entries(FAQ_CATEGORIES).map(([key, label]) => (
              <button
                className={`${styles.sideLink} ${category === key ? styles.sideActive : ""}`}
                key={key}
                aria-pressed={category === key}
                onClick={() => filter({ category: key })}
              >
                {label}
              </button>
            ))}
          </nav>
          <section>
            <div className={styles.filterLine}>
              <span className={styles.meta} role="status">
                {results.length}개의 도움말
                {query ? ` · ‘${query}’ 검색 결과` : ""}
              </span>
              <span className={styles.meta}>안내 기준 2026.10.26</span>
            </div>
            <div className={styles.panel}>
              {results.map((faq) => (
                <details
                  key={faq.id}
                  id={faq.id}
                  className={styles.faqItem}
                  ref={(node) => {
                    refs.current[faq.id] = node;
                  }}
                  open={expanded === faq.id}
                >
                  <summary
                    onClick={(event) => {
                      event.preventDefault();
                      setExpanded((current) =>
                        current === faq.id ? "" : faq.id,
                      );
                    }}
                  >
                    <span className={styles.faqQ}>Q.</span>
                    {faq.question}
                  </summary>
                  <div className={styles.faqAnswer}>
                    {faq.answer.map((p, i) => (
                      <p key={i}>{p}</p>
                    ))}
                    <div className={styles.actions}>
                      {faq.links.map((link) => (
                        <Link key={link.href} href={link.href}>
                          {link.label}
                          <Icon name="arrow" size={14} />
                        </Link>
                      ))}
                      <button
                        className={styles.textButton}
                        onClick={async () => {
                          const url = new URL(
                            `/faq#${faq.id}`,
                            window.location.origin,
                          ).href;
                          try {
                            await navigator.clipboard.writeText(url);
                            setCopyMessage("답변 링크를 복사했습니다.");
                          } catch {
                            setCopyMessage(`이 주소를 복사해 주세요: ${url}`);
                          }
                        }}
                      >
                        이 답변 링크
                      </button>
                    </div>
                  </div>
                </details>
              ))}
              {!results.length && (
                <div className={styles.empty}>
                  <Icon name="search" size={30} />
                  <h2>다른 표현으로 찾아볼까요?</h2>
                  <p>짧은 단어로 검색하거나 전체 도움말을 확인해 주세요.</p>
                  <button
                    className={styles.secondary}
                    onClick={() => router.replace("/faq", { scroll: false })}
                  >
                    검색 초기화
                  </button>
                </div>
              )}
            </div>
            {copyMessage && (
              <p className={styles.notice} role="status">
                {copyMessage}
              </p>
            )}
            <div className={styles.faqCta}>
              <div>
                <h2>아직 답을 찾지 못하셨나요?</h2>
                <p>
                  함께 나눌 질문은 게시판에,
                  <br />
                  개인적인 문제는 비공개 문의로 남겨 주세요.
                </p>
              </div>
              <div className={styles.actions}>
                <Link
                  className={styles.secondary}
                  href="/community/new?category=question"
                >
                  질문하기
                </Link>
                <Link
                  className={styles.primary}
                  href="/community/new?visibility=private&category=support"
                >
                  <Icon name="lock" size={15} />
                  비공개 문의
                </Link>
              </div>
            </div>
          </section>
        </div>
      </div>
    </PageContainer>
  );
}

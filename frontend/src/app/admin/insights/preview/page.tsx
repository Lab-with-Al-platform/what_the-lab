"use client";

import { useEffect, useRef, useState } from "react";
import { ArticleView } from "@/components/article-view";
import type { InsightArticle } from "@/lib/insights";
import "./preview.css";

/** 같은 사이트의 관리자 부모 창에서 받은 원고만 표시합니다. 서버에는 저장하지 않습니다. */
export default function InsightPreviewPage() {
  const [content, setContent] = useState<{ article: InsightArticle; hideCover: boolean } | null>(null);
  const page = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = page.current;
    if (!element) return;
    // 이미지·용어 설명의 높이가 바뀌어도 부모가 전체 본문을 축소해 표시하게 합니다.
    function measure() {
      if (!element) return;
      const bounds = element.getBoundingClientRect();
      window.parent.postMessage({ type: "insight-preview-size", width: Math.ceil(bounds.width), height: Math.ceil(bounds.height), viewportWidth: window.innerWidth }, window.location.origin);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    window.addEventListener("resize", measure);
    return () => { observer.disconnect(); window.removeEventListener("resize", measure); };
  }, []);
  useEffect(() => {
    function receive(event: MessageEvent) {
      if (event.origin !== window.location.origin || event.source !== window.parent || event.data?.type !== "insight-preview") return;
      const article = event.data.article;
      if (!article || typeof article.title !== "string" || !Array.isArray(article.sections)) return;
      setContent({ article, hideCover: event.data.hideCover === true });
    }
    // 미리보기 안의 링크가 편집 화면에서 벗어나게 하지 않습니다. 목차 이동은 유지합니다.
    function guard(event: MouseEvent) {
      const anchor = event.target instanceof Element ? event.target.closest("a") : null;
      if (!anchor) return;
      event.preventDefault();
      const href = anchor.getAttribute("href");
      const target = href?.startsWith("#") ? document.getElementById(href.slice(1)) : null;
      if (target) window.parent.postMessage({ type: "insight-preview-scroll", top: target.getBoundingClientRect().top + window.scrollY }, window.location.origin);
    }
    window.addEventListener("message", receive);
    document.addEventListener("click", guard, true);
    window.parent.postMessage({ type: "insight-preview-ready" }, window.location.origin);
    return () => { window.removeEventListener("message", receive); document.removeEventListener("click", guard, true); };
  }, []);
  return <div ref={page} className="insight-preview-page">{content ? <ArticleView article={content.article} hideCover={content.hideCover} contentOnly /> : <p className="p-8 text-sm text-muted">미리보기 원고를 기다리고 있습니다…</p>}</div>;
}

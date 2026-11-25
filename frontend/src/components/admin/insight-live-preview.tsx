"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { InsightArticle } from "@/lib/insights";
import { ADMIN_BUTTON } from "./admin-ui";

const VIEWPORTS = { web: 1440, mobile: 390 } as const;

export function InsightLivePreview({ article, hideCover }: { article: InsightArticle; hideCover: boolean }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<keyof typeof VIEWPORTS>("web");
  const [availableWidth, setAvailableWidth] = useState(0);
  const [size, setSize] = useState({ width: 720, height: 1000 });
  const scale = availableWidth ? Math.min(1, availableWidth / size.width) : 1;

  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    // 패널이 아닌 가상 기기의 폭으로 배치한 다음 표시 크기만 줄입니다.
    const observer = new ResizeObserver(() => setAvailableWidth(element.clientWidth));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const send = useCallback(() => {
    frame.current?.contentWindow?.postMessage({ type: "insight-preview", article, hideCover }, window.location.origin);
  }, [article, hideCover]);
  useEffect(() => {
    send();
    function receive(event: MessageEvent) {
      if (event.origin !== window.location.origin || event.source !== frame.current?.contentWindow) return;
      if (event.data?.type === "insight-preview-ready") send();
      if (event.data?.type === "insight-preview-size") {
        const { width, height, viewportWidth } = event.data;
        if (viewportWidth !== VIEWPORTS[mode]) return;
        if (Number.isFinite(width) && width > 0 && width <= VIEWPORTS.web && Number.isFinite(height) && height > 0 && height < 1000000) {
          setSize({ width, height });
        }
      }
      if (event.data?.type === "insight-preview-scroll" && Number.isFinite(event.data.top)) {
        viewport.current?.scrollTo({ top: Math.max(0, event.data.top * scale) });
      }
    }
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, [send, mode, scale]);

  function changeMode(next: keyof typeof VIEWPORTS) {
    setMode(next);
    viewport.current?.scrollTo({ top: 0 });
  }

  return <div className="flex min-h-0 flex-1 flex-col">
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-line bg-white px-3 py-2">
      <div role="group" aria-label="미리보기 화면 모드" className="flex gap-1">{(["web", "mobile"] as const).map((value) => <button key={value} type="button" aria-pressed={mode === value} onClick={() => changeMode(value)} className={`${ADMIN_BUTTON} ${mode === value ? "bg-brand-soft text-brand" : "bg-white"}`}>{value === "web" ? "웹 버전" : "모바일 버전"}</button>)}</div>
      <p role="status" className="text-[11px] text-muted">{VIEWPORTS[mode]}px 기준 · {Math.round(scale * 100)}% 표시</p>
    </div>
    <p className="shrink-0 px-3 py-2 text-[11px] leading-5 text-muted">글 본문만 표시 · 편집 중인 미리보기이며 저장·승인·게시는 별도입니다.</p>
    <div ref={viewport} aria-label="글 본문 미리보기 스크롤 영역" tabIndex={0} className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
      {/* 본문 전체 높이를 함께 줄여, 축소 후에도 마지막 문단까지 스크롤할 수 있습니다. */}
      <div className="relative mx-auto overflow-hidden" style={{ width: size.width * scale, height: size.height * scale }}>
        <iframe ref={frame} title="사이트 표시 미리보기" src="/admin/insights/preview" onLoad={send} width={VIEWPORTS[mode]} height={size.height} style={{ width: VIEWPORTS[mode], height: size.height, transform: `scale(${scale})`, transformOrigin: "top left" }} className="absolute left-0 top-0 max-w-none border-0 bg-page" />
      </div>
    </div>
  </div>;
}

"use client";

import { useEffect, useState } from "react";

interface TocItem {
  id: string;
  label: string;
}

interface ArticleTocProps {
  items: TocItem[];
  placement: "sidebar" | "inline";
}

/** 데스크톱은 왼쪽 고정 목차, 모바일은 현재 절이 보이는 접이식 목차입니다. */
export function ArticleToc({ items, placement }: ArticleTocProps) {
  const [activeId, setActiveId] = useState(items[0]?.id ?? "");
  const [open, setOpen] = useState(false);
  const active = items.find((item) => item.id === activeId) ?? items[0];

  useEffect(() => {
    const sections = items
      .map((item) => document.getElementById(item.id))
      .filter((section): section is HTMLElement => section !== null);

    if (sections.length === 0) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((left, right) => left.boundingClientRect.top - right.boundingClientRect.top)[0];
        if (visible?.target.id) {
          setActiveId(visible.target.id);
        }
      },
      { rootMargin: "-30% 0px -55% 0px", threshold: [0, 1] },
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [items]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  if (placement === "sidebar") {
    return (
      <nav className="sticky top-[calc(var(--header-height)+24px)] hidden h-fit xl:block" aria-label="목차">
        <p className="text-sm font-semibold text-ink">목차</p>
        <ol className="mt-3 space-y-1 text-[12px]">
          {items.map((item, index) => (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                className={`block border-l-2 py-1.5 pr-1 pl-3 ${
                  item.id === activeId ? "border-brand font-semibold text-brand" : "border-transparent text-muted hover:text-ink"
                }`}
                aria-current={item.id === activeId ? "location" : undefined}
              >
                {String(index + 1).padStart(2, "0")}. {item.label}
              </a>
            </li>
          ))}
        </ol>
      </nav>
    );
  }

  return (
    // 스크롤해도 헤더와 목차 사이에 24px를 유지합니다. 배경색으로 가려 글이 틈으로 비치지 않습니다.
    <div className="sticky top-[var(--header-height)] z-30 mt-5 bg-page pt-[var(--toc-sticky-gap)] xl:hidden">
      <div className="rounded-[8px] border border-line bg-card/95 px-4 backdrop-blur">
        <button
          type="button"
          className="flex min-h-12 w-full items-center justify-between gap-3 text-left text-sm"
          aria-expanded={open}
          aria-controls="mobile-toc"
          onClick={() => setOpen((current) => !current)}
        >
          <span className="min-w-0">
            <span className="mr-2 text-xs font-semibold text-ink">목차</span>
            <span className="font-semibold">{active?.label}</span>
          </span>
          <span className="text-xs text-muted" aria-hidden="true">{open ? "▲" : "▼"}</span>
        </button>
        {open ? (
          <ol id="mobile-toc" className="max-h-[min(60vh,360px)] space-y-1 overflow-y-auto pb-2 text-sm">
            {items.map((item, index) => (
              <li key={item.id}>
                <a
                  href={`#${item.id}`}
                  className="flex min-h-11 items-center rounded-lg px-2 hover:bg-page"
                  onClick={() => setOpen(false)}
                >
                  {String(index + 1).padStart(2, "0")}. {item.label}
                </a>
              </li>
            ))}
          </ol>
        ) : null}
      </div>
    </div>
  );
}

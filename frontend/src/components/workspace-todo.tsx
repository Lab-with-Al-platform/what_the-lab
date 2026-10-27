"use client";

import { ReactNode, useState } from "react";

export type TodoItem = {
  key: string;
  tone: "brand" | "danger" | "muted"; // 왼쪽 점 색: 급함(빨강) · 할 일(보라) · 권장(회색)
  text: ReactNode;
  action: ReactNode; // 오른쪽 버튼
  onDismiss?: () => void; // 있으면 × 로 숨길 수 있어요
};

const FOLDED = 3; // 처음에는 3개까지만 보여 주고 나머지는 [더 보기]

/** 오른쪽 "지금 할 일". 협업이 몇 개든 해야 할 일만 모아 보여 줘요. 할 일이 없으면 통째로 안 보여요. */
export function TodoBox({ items }: { items: TodoItem[] }) {
  const [all, setAll] = useState(false);
  if (items.length === 0) return null;
  const shown = all ? items : items.slice(0, FOLDED);
  const dot = { brand: "bg-brand", danger: "bg-danger", muted: "bg-faint" };

  return (
    <section className="rounded-card border border-brand/30 bg-brand-soft/60 p-5">
      <h2 className="text-[15px] font-bold">
        지금 할 일 <span className="text-brand">{items.length}</span>
      </h2>
      <ul className="mt-2">
        {shown.map((item) => (
          <li key={item.key} className="border-t border-brand/15 py-3 first:border-t-0">
            <p className="flex items-start gap-2 text-[13px] leading-5">
              <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${dot[item.tone]}`} />
              <span>{item.text}</span>
            </p>
            <div className="mt-2 flex items-center gap-1 pl-4">
              {item.action}
              {item.onDismiss && (
                <button
                  type="button"
                  onClick={item.onDismiss}
                  aria-label="이 할 일 숨기기"
                  className="grid h-8 w-8 place-items-center rounded-button text-lg text-faint hover:bg-card"
                >
                  ×
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
      {items.length > FOLDED && (
        <button type="button" onClick={() => setAll((value) => !value)} className="mt-1 text-[13px] font-semibold text-brand hover:underline">
          {all ? "접기" : `${items.length - FOLDED}개 더 보기`}
        </button>
      )}
    </section>
  );
}
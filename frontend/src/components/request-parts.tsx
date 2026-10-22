"use client";

// 요청관리 화면(연구회원·AI 전문가)이 같이 쓰는 작은 화면 조각

/** 프로필 사진 동그라미 (서비스 사진 또는 기본 사진) */
export function Avatar({ src, size = 40 }: { src: string; size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- 헤더와 같은 방식(디스코드 사진 또는 기본 사진)
    <img src={src} alt="" style={{ width: size, height: size }} className="shrink-0 rounded-full bg-page object-cover" />
  );
}

/** 상태 배지 */
export function StatusBadge({ tone, children }: { tone: "brand" | "success" | "muted" | "danger"; children: string }) {
  const tones = {
    brand: "bg-brand-soft text-brand",
    success: "bg-success-soft text-success",
    muted: "bg-page text-muted border border-line",
    danger: "bg-danger-soft text-danger",
  };
  return <span className={`inline-flex h-6 shrink-0 items-center whitespace-nowrap rounded-full px-2.5 text-[11px] font-bold ${tones[tone]}`}>{children}</span>;
}

/** 위쪽 탭 (숫자 배지, 확인이 필요한 탭은 점 표시) */
export function Tabs<T extends string>({
  tabs,
  current,
  onChange,
}: {
  tabs: { key: T; label: string; short?: string; count: number; dot?: boolean }[]; // short = 모바일에서 보일 짧은 이름
  current: T;
  onChange: (key: T) => void;
}) {
  return (
    <div role="tablist" className="flex gap-1 overflow-x-auto border-b border-line">
      {tabs.map((tab) => {
        const active = tab.key === current;
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.key)}
            className={`relative flex h-11 shrink-0 items-center gap-1.5 px-3 text-sm ${active ? "font-bold text-ink" : "text-muted hover:text-ink"}`}
          >
            <span className="hidden sm:inline">{tab.label}</span>
            <span className="sm:hidden">{tab.short ?? tab.label}</span>
            {tab.count > 0 && (
              <span className={`rounded-full px-1.5 text-[11px] font-bold ${active ? "bg-brand text-white" : "bg-page text-muted"}`}>{tab.count}</span>
            )}
            {tab.dot && <span className="h-1.5 w-1.5 rounded-full bg-danger" aria-label="확인 필요" />}
            {active && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brand" />}
          </button>
        );
      })}
    </div>
  );
}
"use client";

import { useEffect, useId, useState } from "react";
import { requestApi } from "@/lib/api";
import { KEYWORDS_PATH, MAX_KEYWORDS, groupKeywords, type ApprovedKeyword } from "@/lib/admin-insights";
import { ADMIN_FIELD } from "./admin-ui";

/** 승인된 CAP 목록에서 골라 기술 ID를 연결합니다. 직접 타이핑하다 생기는 오타·미승인 ID를 막습니다. */
export function InsightKeywordPicker({ value, onChange }: { value: string[]; onChange: (ids: string[]) => void }) {
  const selectId = useId();
  const [items, setItems] = useState<ApprovedKeyword[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    requestApi<{ items: ApprovedKeyword[] }>(KEYWORDS_PATH)
      .then((response) => { if (active) setItems(response.items); })
      .catch((problem) => { if (active) setError(problem.message); });
    return () => { active = false; };
  }, []);

  const byId = new Map(items.map((item) => [item.id, item]));
  const selected = value.filter(Boolean);
  const full = selected.length >= MAX_KEYWORDS;

  function add(id: string) {
    if (!id || selected.includes(id) || full) return;
    onChange([...selected, id]);
  }

  return <div className="text-sm">
    <label htmlFor={selectId} className="block font-semibold text-ink">기술 키워드 ID · 분류체계 v4.0 CAP, 최대 {MAX_KEYWORDS}개</label>
    <select id={selectId} className={ADMIN_FIELD} value="" disabled={full || items.length === 0} onChange={(event) => add(event.target.value)}>
      <option value="">{full ? `최대 ${MAX_KEYWORDS}개를 모두 골랐습니다` : items.length ? "기술을 선택해 추가하기" : "목록을 불러오는 중…"}</option>
      {groupKeywords(items).map((group) => <optgroup key={group.id} label={group.label}>
        {group.items.map((item) => <option key={item.id} value={item.id} disabled={selected.includes(item.id)}>{item.label} ({item.id})</option>)}
      </optgroup>)}
    </select>
    {error ? <p role="alert" className="mt-2 text-xs text-danger">기술 목록을 불러오지 못했습니다: {error}</p> : null}
    {selected.length ? <ul className="mt-3 flex flex-wrap gap-2" aria-label="선택한 기술 키워드">
      {selected.map((id) => {
        const item = byId.get(id);
        // 예전 원고에 남아 있는 미승인·오타 ID는 지우도록 따로 표시합니다. 서버도 승인 시 다시 거절합니다.
        const unknown = items.length > 0 && !item;
        return <li key={id} className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs ${unknown ? "border-danger text-danger" : "border-brand/30 bg-brand-soft text-brand"}`}>
          <span>{item ? `${item.label} · ${id}` : `${id}${unknown ? " · 승인 목록에 없음" : ""}`}</span>
          <button type="button" className="ml-1 min-h-6 min-w-6 font-semibold" aria-label={`${item?.label ?? id} 키워드 빼기`} onClick={() => onChange(selected.filter((value) => value !== id))}>×</button>
        </li>;
      })}
    </ul> : null}
  </div>;
}

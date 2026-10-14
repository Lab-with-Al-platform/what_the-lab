"use client";

import { useMemo, useState } from "react";
import { findMockExperts, fieldName, mockFields, mockSkills, skillName } from "@/lib/mock-expert-search";

// 시안과 운영 검색을 건드리지 않고, 가상 데이터 흐름만 따로 살펴보는 화면이다.
export function MockExpertSearchDemo() {
  const [query, setQuery] = useState("");
  const [skillId, setSkillId] = useState("");
  const [fieldId, setFieldId] = useState("");
  const [availableOnly, setAvailableOnly] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const results = useMemo(() => findMockExperts({ query, skillId: skillId || undefined, fieldId: fieldId || undefined, availableOnly }), [query, skillId, fieldId, availableOnly]);
  const selected = results.find((expert) => expert.id === selectedId);

  return (
    <main style={{ maxWidth: 960, margin: "auto", padding: 32, fontFamily: "sans-serif" }}>
      <p style={{ color: "#6b55bd" }}>WHAT THE LAB · 내부 테스트 전용</p>
      <h1 style={{ fontSize: 28, fontWeight: 700 }}>AI 전문가 찾기 — Mock Data</h1>
      <p>실제 전문가가 아닌 가상 데이터 20명입니다. 협업 요청 전송은 아직 연결하지 않았습니다.</p>
      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr", margin: "20px 0" }}>
        <input aria-label="검색어" placeholder="기술명 또는 분야 검색" value={query} onChange={(e) => setQuery(e.target.value)} style={{ padding: 12, border: "1px solid #aaa", gridColumn: "1 / -1" }}/>
        <select aria-label="수행 기술" value={skillId} onChange={(e) => setSkillId(e.target.value)} style={{ padding: 12, border: "1px solid #aaa" }}>
          <option value="">전체 수행 기술</option>{mockSkills.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
        <select aria-label="경험 분야" value={fieldId} onChange={(e) => setFieldId(e.target.value)} style={{ padding: 12, border: "1px solid #aaa" }}>
          <option value="">전체 연구 분야</option>{mockFields.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
        </select>
        <label><input type="checkbox" checked={availableOnly} onChange={(e) => setAvailableOnly(e.target.checked)}/> 바로 협의 가능만 보기</label>
      </div>
      <p>검색 결과: {results.length}명</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
        {results.map((expert) => <article key={expert.id} style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16 }}>
          <h2 style={{ fontWeight: 700 }}>{expert.displayName} <small style={{ color: "#777" }}>가상</small></h2>
          <p>{expert.headline}</p><p>{expert.summary}</p>
          <p style={{ fontSize: 13 }}>{expert.skillIds.map(skillName).join(" · ")}</p>
          <button onClick={() => setSelectedId(expert.id)} style={{ textDecoration: "underline" }}>프로필 상세 보기</button>
        </article>)}
      </div>
      {results.length === 0 && <p>조건에 맞는 가상 전문가가 없습니다. 필터를 줄여 보세요.</p>}
      {selected && <section style={{ marginTop: 24, padding: 20, background: "#f5f4ff", borderRadius: 12 }}>
        <h2 style={{ fontWeight: 700 }}>{selected.displayName} 상세</h2>
        <p>{selected.summary}</p><p>경험 분야: {selected.experienceFieldIds.map(fieldName).join(", ")}</p>
        <p>활용 도구: {selected.tools.join(", ")}</p>
        <p style={{ color: "#865" }}>협업 요청은 실제 API/인증 연결 이후 사용 가능합니다.</p>
        <button onClick={() => setSelectedId("")}>닫기</button>
      </section>}
    </main>
  );
}

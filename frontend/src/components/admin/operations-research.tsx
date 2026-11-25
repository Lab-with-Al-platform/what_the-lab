"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { ApiError, requestApi } from "@/lib/api";
import { PageResult, RESEARCH_PROGRESS_STATES, ResearchDetail, ResearchItem, Summary, formatWhen, researchProgress } from "@/lib/operations-admin";
import { demoResearchDetail, demoResearches, demoSummary } from "@/lib/admin-demo";
import { ADMIN_BUTTON, ADMIN_FIELD } from "./admin-ui";
import { AdminIcon, adminHref, useAdminDemo } from "./admin-shell";
import { ChartPanel, DistributionChart, PeriodToolbar, StatCard, TrendChart } from "./admin-charts";
import { CollaborationPanel } from "./operations-collaboration";
import { RegistrationPanel } from "./operations-analytics";
import { OperationsFrame, ScreenTabs } from "./operations-frame";
import styles from "./admin-workspace.module.css";

/** 목록과 상세가 같은 상태 표시를 사용합니다. 색뿐 아니라 문구로도 구분합니다. */
function ProgressBadge({ item }: { item: ResearchItem }) {
  const progress = researchProgress(item);
  return <span className={styles.status} data-tone={progress.tone} title={progress.note}>{progress.label}</span>;
}

export function ProjectsScreen() {
  const params = useSearchParams();
  const router = useRouter();
  const demo = useAdminDemo();
  const tab = params.get("tab") === "abandonment" ? "abandonment" : params.get("tab") === "requests" ? "requests" : "list";
  const preset = params.get("preset") ?? "30d";
  const query = params.toString();
  const [summary, setSummary] = useState<Summary["researches"] | null>(null);
  const [list, setList] = useState<PageResult<ResearchItem> | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true); setError(""); setList(null);
    const result = demo ? Promise.resolve(demoSummary(preset).researches) : requestApi<Summary["researches"]>("/admin/operations/researches/summary?preset=" + preset);
    result.then(body => { if (active) setSummary(body); }).catch((problem: unknown) => { if (active) { setSummary(null); setError(problem instanceof ApiError ? problem.message : "연구 현황을 불러오지 못했습니다."); } });
    const listResult = demo ? Promise.resolve(demoResearches(new URLSearchParams(query))) : requestApi<PageResult<ResearchItem>>("/admin/operations/researches?" + query);
    listResult.then(body => { if (active) setList(body); }).catch((problem: unknown) => { if (active) setError(problem instanceof ApiError ? problem.message : "목록을 불러오지 못했습니다."); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [query, preset, demo, reload]);

  function changeQuery(key: string, value: string) {
    const next = new URLSearchParams(params); next.set(key, value);
    router.replace("/admin/projects?" + next, { scroll:false });
  }
  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = new URLSearchParams({ preset });
    for (const [key, value] of new FormData(event.currentTarget).entries()) {
      if (typeof value === "string" && value.trim()) next.set(key, value.trim());
    }
    next.set("page", "1"); next.set("view", "list");
    router.push(adminHref("/admin/projects?" + next, demo), { scroll:false });
  }
  const page = Number(params.get("page") ?? 1);
  const pages = list ? Math.max(1, Math.ceil(list.total / list.page_size)) : 1;
  const draftCount = summary?.records.value != null && summary.registered.value != null ? summary.records.value - summary.registered.value : null;
  const chosenView = params.get("view");
  const view = chosenView === "dashboard" || chosenView === "list" ? chosenView : tab !== "list" || page > 1 || ["status", "q", "progress_status", "field_id", "able_work_id", "created_start", "created_end"].some((key) => params.get(key)) ? "list" : "dashboard";
  function changeView(next: "dashboard" | "list") {
    const query = new URLSearchParams(params); query.set("view", next);
    router.replace("/admin/projects?" + query, { scroll: false });
  }

  return <OperationsFrame title="연구 등록 관리" description="연구의 작성 상태와 모집·협업 진행 상태를 함께 살펴보세요. 연구 등록과 프로젝트 확정은 구분합니다." tools={<PeriodToolbar inline preset={preset} onChange={value => changeQuery("preset", value)} onRefresh={() => setReload(value => value + 1)} />}>
    <ScreenTabs value={view} onChange={changeView} />
    {error ? <p role="alert" className={styles.error}>{error}</p> : null}
    {view === "dashboard" && summary ? <><div className={styles.stats}>
      <StatCard label="등록된 연구" card={summary.registered} unit="건" icon="research" />
      <StatCard label="임시저장 연구" card={{ status:draftCount === null ? "not_collected" : "ready", value:draftCount, note:"저장 전 작성 중단과는 다릅니다" }} unit="건" icon="insights" />
      <StatCard label="기간 연구 생성" card={summary.created} unit="건" icon="chart" />
      <StatCard label="전체 연구 레코드" card={summary.records} unit="건" icon="overview" />
    </div>
    <div className={styles.charts}>
      <ChartPanel title="연구 레코드 생성 추이" subtitle="계정별 연구 작성 시작 · 임시저장 레코드 포함" label="선택 기간"><TrendChart title="연구 생성 추이" points={summary.created.series ?? []} /></ChartPanel>
      <ChartPanel title="어떤 분야의 연구인가요?" subtitle={summary.fields.note}><DistributionChart unit="건" denominator={summary.registered.value ?? undefined} items={summary.fields.items.map(item => ({label:item.name,value:item.count}))} note="여러 분야를 선택한 연구는 각 분야에 포함됩니다." /></ChartPanel>
    </div></> : null}
    {view === "list" ? <><div className={styles.localTabs} aria-label="연구 관리 보기"><button type="button" aria-pressed={tab === "list"} onClick={() => changeQuery("tab", "list")}>등록 현황·목록</button><button type="button" aria-pressed={tab === "abandonment"} onClick={() => changeQuery("tab", "abandonment")}>등록 과정 분석</button><button type="button" aria-pressed={tab === "requests"} onClick={() => changeQuery("tab", "requests")}>협업 요청</button></div>
    {tab === "requests" ? <CollaborationPanel /> : tab === "abandonment" ? <>
      {demo ? <div className={styles.charts}>
        <ChartPanel title="어느 단계까지 작성했을까요?" subtitle="가상 신규 작성 시도 240건 · 각 단계에 도달한 시도" label="데모 전용"><DistributionChart denominator={240} unit="건" items={[{label:"01 연구",value:240},{label:"02 데이터",value:196},{label:"03 협업",value:170},{label:"04 확인",value:132}]} note="확인 단계 도달은 등록 완료와 다릅니다. 실제 전환율이 아닌 디자인 예시입니다." /></ChartPanel>
        <ChartPanel title="직접 선택한 중단 사유" subtitle="가상 응답 54건 · 응답하지 않은 사용자는 포함하지 않음"><DistributionChart unit="건" items={[{label:"나중에 이어서 작성",value:18},{label:"데이터 준비 중",value:14},{label:"입력 설명이 어려움",value:10},{label:"공유·보안 조건 고민",value:7},{label:"오류 또는 기타",value:5}]} note="사용자 응답과 마지막 단계·오류 같은 관찰 신호는 별개입니다." /></ChartPanel>
      </div> : <RegistrationPanel />}
    </> : <>
      <section className={styles.panel}>
        <div className={styles.listHeader}><h2>연구 등록 목록 <span className={styles.pill}>{list?.total.toLocaleString() ?? "—"}건</span></h2><span className={styles.meta}>최근 생성순</span></div>
        <form key={query + String(demo)} onSubmit={apply} className={styles.filters}>
          <div className={styles.filterRow}>
            <label>연구 검색<input name="q" maxLength={60} defaultValue={params.get("q") ?? ""} placeholder="연구 번호, 제목 또는 등록자" className={ADMIN_FIELD} /></label>
            <label>작성 상태<select name="status" defaultValue={params.get("status") ?? ""} className={ADMIN_FIELD}><option value="">전체 상태</option><option value="draft">임시저장</option><option value="registered">등록</option></select></label>
            <label>진행 상태<select name="progress_status" defaultValue={params.get("progress_status") ?? ""} className={ADMIN_FIELD}><option value="">전체 진행 상태</option>{RESEARCH_PROGRESS_STATES.map(state => <option key={state.code} value={state.code}>{state.label}</option>)}</select></label>
            <button type="submit" className={ADMIN_BUTTON + " bg-ink text-white"}>검색</button>
            <button type="button" className={ADMIN_BUTTON} onClick={() => router.push(adminHref("/admin/projects?preset=" + preset + "&view=list", demo), {scroll:false})}>초기화</button>
          </div>
          <details className={styles.moreFilters}><summary>분야·과업·기간 상세 필터</summary><div className={styles.filterRow}>
            <label>분야 ID<input name="field_id" defaultValue={params.get("field_id") ?? ""} className={ADMIN_FIELD} list="admin-field-options" /><datalist id="admin-field-options">{summary?.fields.items.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</datalist></label>
            <label>과업 ID<input name="able_work_id" defaultValue={params.get("able_work_id") ?? ""} className={ADMIN_FIELD} /></label>
            <label>생성 시작<input name="created_start" type="date" defaultValue={params.get("created_start") ?? ""} className={ADMIN_FIELD} /></label>
            <label>생성 끝(제외)<input name="created_end" type="date" defaultValue={params.get("created_end") ?? ""} className={ADMIN_FIELD} /></label>
          </div></details>
        </form>
        <div className={styles.resultBar}><span role="status">{loading ? "목록을 불러오는 중…" : "검색 결과 " + (list?.total ?? 0) + "건"}</span><span>본문·원자료는 표시하지 않습니다</span></div>
        <div className={styles.tableScroll}><table className={styles.table}><caption className="sr-only">연구 등록 목록</caption><thead><tr>{["연구", "등록자", "연구 분야", "작성 상태", "진행 상태", "생성일", "수정일", "상세"].map(label => <th key={label}>{label}</th>)}</tr></thead><tbody>
          {list?.items.length ? list.items.map(item => <tr key={item.research_id}>
            <td><strong className="block max-w-60 truncate">{item.title}</strong><span className={styles.meta}>#{item.research_id}</span></td>
            <td><Link href={adminHref("/admin/members/" + item.user_id, demo)}>{item.owner_nickname}</Link></td>
            <td>{item.fields.map(field => field.name).join(", ") || "—"}</td>
            <td><span className={styles.status} data-tone={item.status === "registered" ? "success" : "warning"}>{item.status_label}</span></td>
            <td><ProgressBadge item={item} /></td>
            <td className="whitespace-nowrap">{formatWhen(item.created_at)}</td>
            <td className="whitespace-nowrap">{formatWhen(item.updated_at)}</td>
            <td><Link href={adminHref("/admin/projects/researches/" + item.research_id, demo)}>상세 보기</Link></td>
          </tr>) : <tr><td colSpan={8} className="py-10 text-center">{loading ? "불러오는 중…" : "조건에 맞는 연구가 없습니다."}</td></tr>}
        </tbody></table></div>
        <nav className={styles.pagination} aria-label="연구 목록 페이지"><button type="button" className={ADMIN_BUTTON} disabled={loading || page <= 1} onClick={() => changeQuery("page", String(page - 1))}>이전</button><span>{page} / {pages}</span><button type="button" className={ADMIN_BUTTON} disabled={loading || page >= pages} onClick={() => changeQuery("page", String(page + 1))}>다음</button></nav>
      </section>
      <div className={styles.note}><AdminIcon name="lock" size={15} /><span>{demo ? "진행 상태는 디자인 평가용 가상 예시입니다. 임시저장 연구는 해당 없음으로 표시합니다." : "연구 등록은 공개 모집과 다릅니다. 실데이터의 진행 상태는 연동 전이며, 임시저장 연구는 해당 없음으로 표시합니다."} 모집 마감이나 예정 종료일만으로 프로젝트를 완료 처리하지 않습니다.</span></div>
    </>}</> : null}
    <p className={styles.generatedAt}>기간 생성과 현재 상태를 구분</p>
  </OperationsFrame>;
}

export function ResearchDetailScreen({ researchId }: { researchId: string }) {
  const demo = useAdminDemo();
  const [data, setData] = useState<ResearchDetail | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setError("");
    if (demo) { const value = demoResearchDetail(researchId); setData(value ?? null); if (!value) setError("해당 데모 연구가 없습니다."); return; }
    requestApi<ResearchDetail>(`/admin/operations/researches/${researchId}`)
      .then((body) => {
        if (active) setData(body);
      })
      .catch((problem: unknown) => {
        if (active) setError(problem instanceof ApiError ? problem.message : "연구를 불러오지 못했습니다.");
      });
    return () => {
      active = false;
    };
  }, [researchId, demo]);

  return (
    <OperationsFrame title="연구 등록 상세" description="등록 메타정보만 봅니다. 등록은 공개 모집이 아니고, 공유 조건은 글의 공개 설정이 아닙니다.">
      <Link href={adminHref("/admin/projects", demo)} className="mb-4 inline-flex min-h-11 items-center text-sm font-semibold text-brand underline">연구 목록</Link>
      {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
      {data ? (
        <div className="rounded-card border border-line bg-white p-5 text-sm">
          <h2 className="text-xl font-bold text-ink">{data.title}</h2>
          <p className="mt-2 text-muted">{data.status_label}. {data.status_note}</p>
          <dl className="mt-4 grid gap-3 md:grid-cols-2">
            <div><dt className="text-xs text-muted">작성 상태</dt><dd>{data.status_label}</dd></div>
            <div><dt className="text-xs text-muted">진행 상태</dt><dd className="mt-1"><ProgressBadge item={data} /><p className="mt-1 text-xs leading-5 text-muted">{researchProgress(data).note}</p></dd></div>
            <div><dt className="text-xs text-muted">연구 번호</dt><dd>{data.research_id}</dd></div>
            <div><dt className="text-xs text-muted">등록자</dt><dd><Link className="font-semibold text-brand underline" href={adminHref("/admin/members/" + data.user_id, demo)}>{data.owner_nickname}</Link></dd></div>
            <div><dt className="text-xs text-muted">분야</dt><dd>{data.fields.map((field) => field.name).join(", ") || "없음"}</dd></div>
            <div><dt className="text-xs text-muted">맡길 일</dt><dd>{data.task_unsure ? "아직 모름" : data.able_works.map((work) => work.name).join(", ") || "없음"}</dd></div>
            <div><dt className="text-xs text-muted">데이터 종류</dt><dd>{data.data_types.map((item) => item.label).join(", ") || "없음"}</dd></div>
            <div><dt className="text-xs text-muted">데이터 상태</dt><dd>{data.data_status.label ?? "없음"}</dd></div>
            <div><dt className="text-xs text-muted">공유 조건</dt><dd>{data.share_policy.label ?? "없음"}. {data.share_policy.note}</dd></div>
            <div><dt className="text-xs text-muted">생성 · 수정</dt><dd>{formatWhen(data.created_at)} · {formatWhen(data.updated_at)}</dd></div>
          </dl>
          <p className="mt-4 text-xs leading-5 text-muted">{data.body_access.note}</p>
        </div>
      ) : null}
    </OperationsFrame>
  );
}


"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { ApiError, requestApi } from "@/lib/api";
import { MemberDetail, MemberItem, PageResult, Summary, formatWhen } from "@/lib/operations-admin";
import { demoMemberDetail, demoMembers, demoSummary } from "@/lib/admin-demo";
import { ADMIN_BUTTON, ADMIN_FIELD } from "./admin-ui";
import { adminHref, useAdminDemo } from "./admin-shell";
import { ChartPanel, DistributionChart, PeriodToolbar, StatCard, TrendChart } from "./admin-charts";
import { OperationsFrame, ScreenTabs, screenView } from "./operations-frame";
import styles from "./admin-workspace.module.css";

export function MembersScreen() {
  const params = useSearchParams();
  const router = useRouter();
  const demo = useAdminDemo();
  const query = params.toString();
  const preset = params.get("preset") ?? "30d";
  const [data, setData] = useState<PageResult<MemberItem> | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true); setError(""); setData(null);
    const listResult = demo ? Promise.resolve(demoMembers(new URLSearchParams(query))) : requestApi<PageResult<MemberItem>>("/admin/operations/members?" + query);
    listResult.then(body => { if (active) setData(body); })
      .catch((problem: unknown) => { if (active) setError(problem instanceof ApiError ? problem.message : "회원 목록을 불러오지 못했습니다."); })
      .finally(() => { if (active) setLoading(false); });
    const summaryResult = demo ? Promise.resolve(demoSummary(preset)) : requestApi<Summary>("/admin/operations/summary?preset=" + preset);
    summaryResult.then(body => { if (active) setSummary(body); }).catch(() => { if (active) setSummary(null); });
    return () => { active = false; };
  }, [query, preset, demo, reload]);

  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const next = new URLSearchParams({ preset });
    for (const [key, value] of form.entries()) {
      if (typeof value === "string" && value.trim()) next.set(key, value.trim());
    }
    next.set("page", "1"); next.set("view", "list");
    router.push(adminHref("/admin/members?" + next, demo), { scroll: false });
  }
  function go(page: number) {
    const next = new URLSearchParams(params); next.set("page", String(page));
    router.push("/admin/members?" + next, { scroll: false });
  }
  function changePeriod(value: string) {
    const next = new URLSearchParams(params); next.set("preset", value);
    router.replace("/admin/members?" + next, { scroll: false });
  }
  const page = Number(params.get("page") ?? "1");
  const pages = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1;
  const view = screenView(params, ["q", "role", "status", "signup_step", "created_start", "created_end", ...(page > 1 ? ["page"] : [])]);
  function changeView(next: "dashboard" | "list") {
    const query = new URLSearchParams(params); query.set("view", next);
    router.replace("/admin/members?" + query, { scroll: false });
  }
  return <OperationsFrame title="회원 관리" description="회원의 구성과 가입 흐름을 살펴보고, 필요한 계정을 빠르게 찾아보세요." tools={<PeriodToolbar inline preset={preset} onChange={changePeriod} onRefresh={() => setReload(value => value + 1)} />}>
    <ScreenTabs value={view} onChange={changeView} />
    {view === "dashboard" && summary ? <>
      <div className={styles.stats}>
        <StatCard label="가입 완료 회원" card={summary.members.completed} />
        <StatCard label="기간 계정 생성" card={summary.members.accounts_created} icon="chart" />
        <StatCard label="가입 진행 중" card={summary.members.in_progress} icon="overview" />
        <StatCard label="정지 계정" card={summary.members.suspended} icon="lock" />
      </div>
      <div className={styles.charts}>
        <ChartPanel title="새로운 계정의 유입" subtitle="계정 생성일 기준 · 가입 완료일과 다릅니다" label="일별 추이"><TrendChart title="회원 계정 생성 추이" points={summary.members.accounts_created.series ?? []} /></ChartPanel>
        <ChartPanel title="현재 역할 구성" subtitle={summary.members.roles.note}><DistributionChart items={[{ label:"연구자", value:summary.members.roles.counts.researcher }, { label:"AI 전문가", value:summary.members.roles.counts.expert }, { label:"미선택", value:summary.members.roles.counts.unset }]} note="역할은 계정당 한 번 집계합니다." /></ChartPanel>
      </div>
    </> : null}
    {error ? <p role="alert" className={styles.error}>{error}</p> : null}
    {view === "list" ? <section className={styles.panel}>
      <div className={styles.listHeader}><h2>회원 목록 <span className={styles.pill}>{data?.total.toLocaleString() ?? "—"}명</span></h2><span className={styles.meta}>최근 계정 생성순</span></div>
      <form key={query + String(demo)} onSubmit={apply} className={styles.filters}>
        <div className={styles.filterRow}>
          <label>회원 검색<input name="q" defaultValue={params.get("q") ?? ""} maxLength={30} placeholder="회원 번호 또는 닉네임" className={ADMIN_FIELD} /></label>
          <label>역할<select name="role" defaultValue={params.get("role") ?? ""} className={ADMIN_FIELD}><option value="">전체 역할</option><option value="researcher">연구자</option><option value="expert">AI 전문가</option><option value="unset">미선택</option></select></label>
          <label>계정 상태<select name="status" defaultValue={params.get("status") ?? ""} className={ADMIN_FIELD}><option value="">탈퇴 제외</option><option value="active">정상</option><option value="suspended">정지</option><option value="deleted">탈퇴</option><option value="any">전체</option></select></label>
          <button type="submit" className={ADMIN_BUTTON + " bg-ink text-white"}>검색</button>
          <button type="button" className={ADMIN_BUTTON} onClick={() => router.push(adminHref("/admin/members?preset=" + preset + "&view=list", demo), { scroll:false })}>초기화</button>
        </div>
        <details className={styles.moreFilters}><summary>가입 단계·기간 상세 필터</summary><div className={styles.filterRow}>
          <label>가입 단계<select name="signup_step" defaultValue={params.get("signup_step") ?? ""} className={ADMIN_FIELD}><option value="">전체 단계</option><option value="role">회원 유형</option><option value="verify">소속 인증</option><option value="info">기본 정보</option><option value="done">가입 완료</option></select></label>
          <label>생성 시작<input name="created_start" type="date" defaultValue={params.get("created_start") ?? ""} className={ADMIN_FIELD} /></label>
          <label>생성 끝(제외)<input name="created_end" type="date" defaultValue={params.get("created_end") ?? ""} className={ADMIN_FIELD} /></label>
        </div></details>
      </form>
      <div className={styles.resultBar}><span role="status">{loading ? "목록을 불러오는 중…" : "검색 결과 " + (data?.total ?? 0) + "명"}</span><span>연락처·비공개 정보는 표시하지 않습니다</span></div>
      <div className={styles.tableScroll}><table className={styles.table}><caption className="sr-only">회원 목록</caption><thead><tr>{["회원", "역할", "소속", "가입 단계", "계정 상태", "생성일", "상세"].map(label => <th key={label}>{label}</th>)}</tr></thead><tbody>
        {data?.items.length ? data.items.map(item => <tr key={item.user_id}>
          <td><div className={styles.person}><span className={styles.avatar}>{item.nickname.slice(0,1)}</span><div><strong>{item.nickname}</strong><small>#{item.user_id}</small></div></div></td>
          <td>{item.role_label}</td><td>{item.affiliation ?? "—"}</td><td>{item.signup_step_label}</td>
          <td><span className={styles.status} data-tone={item.status === "active" ? "success" : "warning"}>{item.status_label}</span></td>
          <td className="whitespace-nowrap">{formatWhen(item.created_at)}</td><td><Link href={adminHref("/admin/members/" + item.user_id, demo)}>상세 보기</Link></td>
        </tr>) : <tr><td colSpan={7} className="py-10 text-center">{loading ? "불러오는 중…" : "조건에 맞는 회원이 없습니다."}</td></tr>}
      </tbody></table></div>
      <nav className={styles.pagination} aria-label="회원 목록 페이지"><button type="button" className={ADMIN_BUTTON} disabled={loading || page <= 1} onClick={() => go(page - 1)}>이전</button><span>{page} / {pages}</span><button type="button" className={ADMIN_BUTTON} disabled={loading || page >= pages} onClick={() => go(page + 1)}>다음</button></nav>
    </section> : null}
    <p className={styles.generatedAt}>현황은 전체 회원 기준</p>
  </OperationsFrame>;
}

export function MemberDetailScreen({ userId }: { userId: string }) {
  const demo = useAdminDemo();
  const [data, setData] = useState<MemberDetail | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    (demo ? Promise.resolve(demoMemberDetail(userId) ?? null) : requestApi<MemberDetail>(`/admin/operations/members/${userId}`))
      .then((body) => {
        if (active) setData(body);
      })
      .catch((problem: unknown) => {
        if (active) setError(problem instanceof ApiError ? problem.message : "회원을 불러오지 못했습니다.");
      });
    return () => {
      active = false;
    };
  }, [userId, demo]);

  return (
    <OperationsFrame title="회원 상세" description="공개에 필요한 계정 정보와 연구 제목만 봅니다. 정지는 로그인만 막고 연구 기록은 지우지 않습니다.">
      <Link href={adminHref("/admin/members", demo)} className="mb-4 inline-flex min-h-11 items-center text-sm font-semibold text-brand underline">회원 목록</Link>
      {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
      {data ? (
        <div className="rounded-card border border-line bg-white p-5">
          <dl className="grid gap-3 text-sm md:grid-cols-2">
            <Item term="회원 번호" value={String(data.user_id)} />
            <Item term="닉네임" value={data.nickname} />
            <Item term="계정 상태" value={data.status_label} />
            <Item term="역할" value={data.role_label} />
            <Item term="소속" value={data.affiliation ?? "없음"} />
            <Item term="가입 단계" value={data.signup_step_label} />
            <Item term="계정 생성" value={formatWhen(data.created_at)} />
            <Item term="공통 관리자 표시" value={data.is_admin ? "예" : "아니오"} />
          </dl>
          <p className="mt-4 text-xs leading-5 text-muted">{data.actions.note}</p>
          {data.actions.status === "ready" && data.actions.next_status && !demo ? (
            <MemberStatusDialog userId={data.user_id} nickname={data.nickname} current={data.status} nextStatus={data.actions.next_status} onChanged={setData} />
          ) : null}
          <h2 className="mt-6 text-base font-bold">운영 이력</h2>
          <p className="mt-1 text-xs text-muted">{data.audit.note}</p>
          {data.audit.items?.length ? (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead><tr className="text-xs text-muted"><th className="py-2">시각</th><th>작업</th><th>이전</th><th>이후</th><th>내부 사유</th><th>사용자 안내</th></tr></thead>
                <tbody>{data.audit.items.map((item) => <tr key={item.created_at + item.action} className="border-t border-line"><td className="py-2">{formatWhen(item.created_at)}</td><td>{item.action === "suspend" ? "정지" : "해제"}</td><td>{item.before_status}</td><td>{item.after_status}</td><td>{item.reason}</td><td>{item.notice || "—"}</td></tr>)}</tbody>
              </table>
            </div>
          ) : <p className="mt-2 text-sm text-muted">기록된 정지·해제가 없습니다.</p>}
          <h2 className="mt-6 text-base font-bold">연구 등록</h2>
          <ul className="mt-2 space-y-2 text-sm">
            {data.researches.length ? data.researches.map((item) => (
              <li key={item.research_id}>
                <Link className="font-semibold text-brand underline" href={adminHref("/admin/projects/researches/" + item.research_id, demo)}>{item.title}</Link>
                <span className="text-muted"> · {item.status_label}</span>
              </li>
            )) : <li className="text-muted">연결된 연구 레코드가 없습니다.</li>}
          </ul>
        </div>
      ) : null}
    </OperationsFrame>
  );
}

function Item({ term, value }: { term: string; value: string }) {
  return <div><dt className="text-xs text-muted">{term}</dt><dd className="font-semibold text-ink">{value}</dd></div>;
}

function MemberStatusDialog({ userId, nickname, current, nextStatus, onChanged }: {
  userId: number; nickname: string; current: string; nextStatus: string; onChanged: (detail: MemberDetail) => void;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [notice, setNotice] = useState("");
  const [key, setKey] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const stopping = nextStatus === "suspended";
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      // 같은 키로 다시 보내면 서버가 이력을 한 번만 남깁니다. 응답이 없어도 성공으로 보이지 않습니다.
      await requestApi(`/admin/operations/members/${userId}/status`, {
        method: "POST",
        body: JSON.stringify({ expected_status: current, next_status: nextStatus, reason, notice, idempotency_key: key }),
      });
      onChanged(await requestApi<MemberDetail>(`/admin/operations/members/${userId}`));
      setOpen(false);
    } catch (problem: unknown) {
      const message = problem instanceof ApiError ? problem.message : "상태를 바꾸지 못했습니다.";
      setError(message);
      if (problem instanceof ApiError && problem.status === 409) {
        requestApi<MemberDetail>(`/admin/operations/members/${userId}`).then(onChanged).catch(() => undefined);
      }
    } finally {
      setBusy(false);
    }
  }
  if (!open) {
    return <button type="button" className={`${ADMIN_BUTTON} mt-4 bg-ink text-white`} onClick={() => { setKey(crypto.randomUUID()); setReason(""); setNotice(""); setError(""); setOpen(true); }}>{stopping ? "계정 정지" : "정지 해제"}</button>;
  }
  return <div className="fixed inset-0 z-30 grid place-items-center bg-ink/40 p-4" role="presentation" onKeyDown={(event) => { if (event.key === "Escape" && !busy) setOpen(false); }}>
    <form role="dialog" aria-modal="true" aria-labelledby="member-status-title" className="w-full max-w-lg rounded-card bg-white p-5 shadow-card" onSubmit={submit}>
      <h2 id="member-status-title" className="text-lg font-bold">{stopping ? "계정을 정지할까요?" : "정지를 해제할까요?"}</h2>
      <p className="mt-2 text-sm leading-6 text-muted">대상 {nickname} · 회원 번호 {userId} · {current} → {nextStatus}. {stopping ? "기존 로그인 쿠키로도 들어갈 수 없게 됩니다. 연구 등록과 협업 기록은 지우거나 취소하지 않고, 안내 문자는 알림으로 보내지 않습니다." : "다시 로그인할 수 있게 됩니다. 다른 기록은 바꾸지 않습니다."}</p>
      <label className="mt-4 block text-sm font-semibold">내부 사유<textarea required maxLength={200} className={ADMIN_FIELD} value={reason} onChange={(event) => setReason(event.target.value)} /></label>
      <label className="mt-3 block text-sm font-semibold">사용자 안내 · 저장만 하고 보내지 않음<textarea maxLength={200} className={ADMIN_FIELD} value={notice} onChange={(event) => setNotice(event.target.value)} /></label>
      {error ? <p role="alert" className="mt-3 text-sm text-danger">{error}</p> : null}
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" className={`${ADMIN_BUTTON} bg-white`} disabled={busy} onClick={() => setOpen(false)}>취소</button>
        <button className={`${ADMIN_BUTTON} bg-ink text-white`} disabled={busy || !reason.trim()}>{busy ? "저장 중" : "확인"}</button>
      </div>
    </form>
  </div>;
}

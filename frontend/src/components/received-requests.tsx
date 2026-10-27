"use client";

import { ReactNode, useEffect, useState } from "react";
import { ApiError, requestApi } from "@/lib/api";
import {
  addDays,
  adjustRange,
  daysBetween,
  deadlineText,
  effectivePeriod,
  formatPeriod,
  LIMITS,
  periodLength,
  photoOrDefault,
  ReceivedRequest,
  REJECT_REASON_LABELS,
  RejectReason,
  RULES,
  shortDate,
  timeLeft,
} from "@/lib/collab-requests";
import type { CareerProfile } from "@/lib/my-career";
import {
  DATA_STATUS_LABELS,
  DATA_TYPE_LABELS,
  formatDate,
  MEETING_LABELS,
  OUTPUT_LABELS,
  REWARD_LABELS,
  SHARE_LABELS,
} from "@/lib/my-research";
import type { AbleWorkOption, FieldCategory } from "@/components/my-research-modal";
import { INPUT_CLASS, Modal } from "@/components/modal";
import { Avatar, StatusBadge, Tabs } from "@/components/request-parts";

type Tab = "new" | "waiting" | "past";
type Names = { works: Map<string, string>; fields: Map<string, string> };

const TAB_OF: Record<ReceivedRequest["status"], Tab> = {
  pending: "new",
  accepted: "waiting",
  started: "past",
  rejected: "past",
  expired: "past",
  canceled: "past",
};

/** AI 전문가 '요청관리'. 왼쪽 목록에서 고르면 오른쪽에 요청 내용과 수락·거절이 보여요. */
export function ReceivedRequests() {
  const [requests, setRequests] = useState<ReceivedRequest[] | null>(null);
  const [myMeeting, setMyMeeting] = useState(""); // 내 협업 조건의 미팅 방식 (비교용)
  const [names, setNames] = useState<Names>({ works: new Map(), fields: new Map() });
  const [loadError, setLoadError] = useState("");
  const [tab, setTab] = useState<Tab>("new");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [mobileDetail, setMobileDetail] = useState(false); // 모바일: 목록 대신 상세를 보는 중

  useEffect(() => {
    Promise.all([
      requestApi<ReceivedRequest[]>("/expert/requests"),
      requestApi<CareerProfile>("/expert/profile"),
      requestApi<AbleWorkOption[]>("/expert/able-works"),
      requestApi<FieldCategory[]>("/taxonomy/fields"),
    ])
      .then(([loaded, profile, works, fields]) => {
        setRequests(loaded);
        const meeting = profile.collaboration;
        setMyMeeting(meeting ? meetingText(meeting.meeting_type, meeting.face_to_area) : "");
        setNames({
          works: new Map(works.map((work) => [work.able_work_id, work.name])),
          fields: new Map(fields.flatMap((category) => category.fields.map((field) => [field.field_id, field.name]))),
        });
      })
      .catch((error) => setLoadError(error instanceof ApiError ? error.message : "잠시 후 다시 시도해 주세요"));
  }, []);

  if (loadError) return <p className="py-20 text-center text-sm text-danger">{loadError}</p>;
  if (!requests) return <p className="py-20 text-center text-sm text-faint">불러오는 중…</p>;

  const lists: Record<Tab, ReceivedRequest[]> = { new: [], waiting: [], past: [] };
  requests.forEach((request) => lists[TAB_OF[request.status]].push(request));
  const shown = lists[tab];
  const selected = shown.find((request) => request.request_id === selectedId) ?? shown[0] ?? null;

  /** 수락·거절·수락 취소 API. 백엔드가 돌려준 최신 목록으로 다시 그려요. */
  async function respond(requestId: number, action: "accept" | "reject" | "withdraw", body: object) {
    const next = await requestApi<ReceivedRequest[]>(`/expert/requests/${requestId}/${action}`, { method: "POST", body: JSON.stringify(body) });
    setRequests(next);
    setSelectedId(requestId);
    // 처리한 요청이 옮겨 간 탭으로 따라가요 (급한 요청은 수락하면 바로 협업이 시작돼 '지난 요청'으로)
    const moved = next.find((request) => request.request_id === requestId);
    setTab(moved ? TAB_OF[moved.status] : "past");
  }

  return (
    <div>
      <h1 className="text-[28px] font-bold">요청관리</h1>
      <p className="mt-1 text-sm text-muted">연구자가 보낸 협업 요청이에요. 데이터 공유 조건에 동의해야 수락할 수 있고, 답 기한이 지나면 자동으로 만료돼요.</p>

      <div className="mt-6">
        <Tabs
          current={tab}
          onChange={(next) => {
            setTab(next);
            setSelectedId(null);
            setMobileDetail(false);
          }}
          tabs={[
            { key: "new", label: "새 요청", count: lists.new.length, dot: lists.new.length > 0 },
            { key: "waiting", label: "연구자 선택 기다리는 중", short: "선택 대기", count: lists.waiting.length },
            { key: "past", label: "지난 요청", count: lists.past.length },
          ]}
        />
      </div>

      {shown.length === 0 ? (
        <EmptyTab tab={tab} />
      ) : (
        <div className="mt-5 grid items-start gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
          {/* 왼쪽: 요청 목록 (모바일에서는 상세를 볼 때 숨겨요) */}
          <ul className={`space-y-2 ${mobileDetail ? "hidden lg:block" : ""}`}>
            {shown.map((request) => (
              <li key={request.request_id}>
                <ListItem
                  request={request}
                  active={request.request_id === selected?.request_id}
                  onClick={() => {
                    setSelectedId(request.request_id);
                    setMobileDetail(true);
                  }}
                />
              </li>
            ))}
          </ul>

          {/* 오른쪽: 고른 요청 (모바일에서는 목록에서 눌렀을 때만) */}
          {selected && (
            <div className={mobileDetail ? "" : "hidden lg:block"}>
              <button type="button" onClick={() => setMobileDetail(false)} className="mb-3 text-sm font-semibold text-muted lg:hidden">
                ← 목록으로
              </button>
              <RequestDetail
                key={selected.request_id}
                request={selected}
                names={names}
                myMeeting={myMeeting}
                onAccept={(body) => respond(selected.request_id, "accept", body)}
                onReject={(reason, text) => respond(selected.request_id, "reject", { reason, text })}
                onWithdraw={(text) => respond(selected.request_id, "withdraw", { text })}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** 왼쪽 목록 한 칸 */
function ListItem({ request, active, onClick }: { request: ReceivedRequest; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "true" : undefined}
      className={`w-full rounded-card border p-4 text-left transition-colors ${active ? "border-brand bg-brand-soft/40" : "border-line bg-card hover:border-brand/40"}`}
    >
      <div className="flex items-center gap-2">
        <Avatar src={photoOrDefault(request.researcher.user_photo, "researcher")} size={28} />
        <span className="min-w-0 flex-1 truncate text-sm font-bold">{request.researcher.nickname}</span>
        {request.is_urgent && request.status === "pending" && <StatusBadge tone="danger">🔥 급해요</StatusBadge>}
        <ItemBadge request={request} />
      </div>
      <p className="mt-2 line-clamp-2 text-sm font-medium leading-snug">{request.research.title}</p>
      <p className="mt-2 text-xs text-faint">{itemLine(request)}</p>
    </button>
  );
}

function ItemBadge({ request }: { request: ReceivedRequest }) {
  switch (request.status) {
    case "pending":
      return <StatusBadge tone="brand">새 요청</StatusBadge>;
    case "accepted":
      return <StatusBadge tone="success">선택 기다리는 중</StatusBadge>;
    case "started":
      return <StatusBadge tone="success">협업 시작됨</StatusBadge>;
    case "rejected":
      return <StatusBadge tone="muted">거절함</StatusBadge>;
    case "expired":
      return <StatusBadge tone="muted">만료됨</StatusBadge>;
    default:
      return <StatusBadge tone="muted">{request.cancel_reason === "expert_withdrew" ? "수락 취소함" : "닫힘"}</StatusBadge>;
  }
}

function itemLine(request: ReceivedRequest): string {
  if (request.status === "pending") return `${deadlineText(request.expires_at)}까지 답하기 · ${timeLeft(request.expires_at)}`;
  if (request.status === "accepted" && request.select_expires_at) return `연구자 선택 기한 ${deadlineText(request.select_expires_at)}`;
  if (request.status === "expired") return request.responded_at ? "연구자가 시작하지 않아 만료" : `${deadlineText(request.expires_at)} 만료`;
  return `${formatDate(request.responded_at ?? request.created_at)} ${request.status === "rejected" ? "거절" : "수락"}`;
}

/** 오른쪽: 요청 하나의 전체 내용 + 수락·거절 */
function RequestDetail({
  request,
  names,
  myMeeting,
  onAccept,
  onReject,
  onWithdraw,
}: {
  request: ReceivedRequest;
  names: Names;
  myMeeting: string;
  onAccept: (body: AcceptBody) => Promise<void>;
  onReject: (reason: RejectReason, text: string) => Promise<void>;
  onWithdraw: (text: string) => Promise<void>;
}) {
  const { researcher, research } = request;
  const period = effectivePeriod(request);
  const works = research.task_unsure ? ["잘 모르겠어요"] : research.able_work_ids.map((id) => names.works.get(id) ?? id);
  const shareText =
    research.share_policy === "conditional"
      ? `조건이 있어요 · ${research.share_condition ?? ""}`
      : research.share_policy
        ? SHARE_LABELS[research.share_policy].title
        : "정하지 않음";
  const affiliation = [researcher.institution_name, researcher.department].filter(Boolean).join(" · ");

  return (
    <article className="rounded-card border border-line bg-card shadow-card">
      {/* 보낸 사람 */}
      <header className="flex flex-wrap items-center gap-3 border-b border-line p-5">
        <Avatar src={photoOrDefault(researcher.user_photo, "researcher")} size={44} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-bold">{researcher.nickname}</p>
            {researcher.is_verified && <StatusBadge tone="success">대학 인증</StatusBadge>}
          </div>
          {affiliation && <p className="mt-0.5 text-xs text-muted">{affiliation}</p>}
        </div>
        {request.status === "pending" && (
          <p className="text-xs font-semibold text-danger">
            {deadlineText(request.expires_at)}까지 답하지 않으면 만료돼요 ({timeLeft(request.expires_at)})
          </p>
        )}
      </header>

      {request.is_urgent && request.status === "pending" && (
        <p className="border-b border-line bg-danger-soft px-5 py-3 text-[13px] font-semibold text-danger">
          🔥 급한 요청이에요. 수락하면 바로 협업이 시작되고, 기간은 조정할 수 없어요.
        </p>
      )}

      <Section>
        <p className="text-xs font-semibold text-faint">{researcher.nickname} 님의 메시지</p>
        <p className="mt-2 whitespace-pre-line rounded-button bg-page px-4 py-3 text-sm leading-relaxed">{request.message || "메시지를 적지 않았어요"}</p>
      </Section>

      <Section title="요청 내용">
        <InfoGrid>
          <Info
            label={period.adjusted ? "조정한 기간" : "희망 기간"}
            value={formatPeriod(period.start, period.end)}
            note={period.adjusted ? `요청한 기간: ${formatPeriod(request.start_date, request.end_date)}` : undefined}
          />
          <Info label="보상 형태" value={research.rewards.map((code) => REWARD_LABELS[code]).join(", ") || "선택 안 함"} />
          <Info
            label="미팅 방식"
            value={research.meeting_type ? meetingText(research.meeting_type, research.face_to_area) : "선택 안 함"}
            note={myMeeting ? `내 미팅 조건: ${myMeeting}` : undefined}
          />
        </InfoGrid>
      </Section>

      <Section title="연구">
        <p className="font-semibold leading-snug">{research.title}</p>
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
          {research.field_ids.map((id) => (
            <span key={id} className="rounded-full bg-researcher-soft px-2 py-0.5 font-semibold text-researcher">
              {names.fields.get(id) ?? id}
            </span>
          ))}
          <span className="ml-1 text-faint">맡길 일</span>
          {works.map((work) => (
            <span key={work} className="rounded-full bg-brand-soft px-2 py-0.5 text-brand">
              {work}
            </span>
          ))}
        </div>
        <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-muted">{research.description}</p>
        <div className="mt-4">
          <Info label="원하는 결과물" value={research.outputs.map((code) => OUTPUT_LABELS[code]).join(", ")} />
        </div>
      </Section>

      <Section title="데이터">
        <InfoGrid>
          <Info label="데이터 종류" value={research.data_types.map((code) => DATA_TYPE_LABELS[code]).join(", ")} />
          <Info label="데이터 상태" value={research.data_status ? DATA_STATUS_LABELS[research.data_status] : ""} />
          <Info label="공유 조건" value={shareText} />
        </InfoGrid>
      </Section>

      <Footer request={request} shareText={shareText} onAccept={onAccept} onReject={onReject} onWithdraw={onWithdraw} />
    </article>
  );
}

/** 수락할 때 보내는 값. 기간을 조정하면 start_date·end_date를 함께 보내요. */
type AcceptBody = { message: string; start_date?: string; end_date?: string };

/** 맨 아래: 상태에 따라 수락 영역 또는 안내 */
function Footer({
  request,
  shareText,
  onAccept,
  onReject,
  onWithdraw,
}: {
  request: ReceivedRequest;
  shareText: string;
  onAccept: (body: AcceptBody) => Promise<void>;
  onReject: (reason: RejectReason, text: string) => Promise<void>;
  onWithdraw: (text: string) => Promise<void>;
}) {
  const [agreed, setAgreed] = useState(false);
  const [reply, setReply] = useState("");
  const [adjusting, setAdjusting] = useState(false); // "기간을 조정해서 수락"
  const [start, setStart] = useState(request.start_date);
  const [end, setEnd] = useState(request.end_date);
  const [rejecting, setRejecting] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (request.status === "accepted") {
    return (
      <div className="rounded-b-card bg-success-soft px-5 py-4 text-sm text-success">
        <p>
          {formatDate(request.responded_at ?? request.created_at)}에 수락했어요. 연구자가
          {request.select_expires_at ? ` ${deadlineText(request.select_expires_at)}까지` : ""} 협업 시작을 고르면 협업 공간이 만들어지고 DM으로 알려 드려요.
        </p>
        <button type="button" onClick={() => setWithdrawing(true)} className="mt-3 h-9 rounded-button border border-line bg-card px-3 text-[13px] font-semibold text-muted hover:bg-page">
          수락 취소
        </button>
        {withdrawing && <WithdrawModal nickname={request.researcher.nickname} onClose={() => setWithdrawing(false)} onWithdraw={onWithdraw} />}
      </div>
    );
  }
  if (request.status !== "pending") return <Notice tone="muted">{pastText(request)}</Notice>;

  const range = adjustRange(request.start_date);
  const length = daysBetween(request.start_date, request.end_date) + 1; // 원래 기간 날 수
  const newLength = daysBetween(start, end) + 1;
  const rangeOk = start >= range.low && start <= range.high;
  const lengthOk = end >= start && newLength >= length / 2 && newLength <= length * 2;
  const changed = start !== request.start_date || end !== request.end_date;
  const periodOk = !adjusting || (rangeOk && lengthOk && changed);

  /** 시작일을 옮기면 종료일도 같은 길이만큼 따라 움직여요. (종료일은 따로 고칠 수 있어요) */
  function moveStart(next: string) {
    setStart(next);
    setEnd(addDays(next, length - 1));
  }

  async function accept() {
    setBusy(true);
    setError("");
    try {
      await onAccept(adjusting ? { message: reply.trim(), start_date: start, end_date: end } : { message: reply.trim() });
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "잠시 후 다시 시도해 주세요");
      setBusy(false);
    }
  }

  return (
    // 기간 조정 칸이 생겨 길어져서, 모바일에서도 화면 아래에 붙이지 않고 제자리에 둬요.
    <div className="space-y-3 rounded-b-card border-t border-line bg-card p-5">
      {request.overlap_count > 0 && (
        <p className="rounded-button bg-trend-soft px-4 py-3 text-[13px] text-trend">
          이 기간에 진행 중인 협업이 {request.overlap_count}개 있어요. 일정이 겹쳐도 괜찮은지 확인해 주세요.
        </p>
      )}

      {/* 기간: 그대로 / 조정해서 수락 (급한 요청은 조정 불가) */}
      {!request.is_urgent && (
        <div className="rounded-button border border-line p-4">
          <p className="text-sm font-semibold">기간</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Choice on={!adjusting} onClick={() => setAdjusting(false)}>
              그대로 좋아요 · {shortDate(request.start_date)} ~ {shortDate(request.end_date)}
            </Choice>
            <Choice on={adjusting} onClick={() => setAdjusting(true)}>
              기간을 조정해서 수락할게요
            </Choice>
          </div>
          {adjusting && (
            <div className="mt-3">
              <div className="flex flex-wrap items-center gap-2">
                <input type="date" aria-label="조정할 시작일" value={start} min={range.low} max={range.high} onChange={(event) => moveStart(event.target.value)} className={`${INPUT_CLASS} w-auto min-w-[150px] flex-1`} />
                <span className="text-muted">~</span>
                <input type="date" aria-label="조정할 종료일" value={end} min={start} onChange={(event) => setEnd(event.target.value)} className={`${INPUT_CLASS} w-auto min-w-[150px] flex-1`} />
              </div>
              <p className="mt-2 text-xs leading-5 text-faint">
                시작일은 <b className="text-ink">{shortDate(range.low)} ~ {shortDate(range.high)}</b> 중에서 고를 수 있어요
                {range.low === request.start_date ? " (이 요청은 시작일을 앞당길 수 없어요)" : ""}. 시작일을 옮기면 종료일도 같은 길이만큼 따라가요.
                기간은 원래({periodLength(request.start_date, request.end_date)})의 절반에서 2배 사이로 정해 주세요. {RULES.adjustDays}일 넘게 미뤄야 하면 거절 후 메시지로 알려 주세요.
              </p>
              {!rangeOk && <p className="mt-1 text-xs text-danger">시작일은 {shortDate(range.low)} ~ {shortDate(range.high)} 중에서 골라 주세요.</p>}
              {rangeOk && !lengthOk && <p className="mt-1 text-xs text-danger">기간 길이를 원래의 절반에서 2배 사이로 맞춰 주세요.</p>}
              {rangeOk && lengthOk && !changed && <p className="mt-1 text-xs text-muted">원래 기간과 같아요. 그대로 수락하려면 위에서 [그대로 좋아요]를 골라 주세요.</p>}
            </div>
          )}
        </div>
      )}

      <label className="flex cursor-pointer items-start gap-3 rounded-button border border-line p-4">
        <input type="checkbox" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} className="mt-0.5 h-4 w-4 accent-brand" />
        <span>
          <span className="block text-sm font-semibold">데이터 공유 조건({shareText.replace("조건이 있어요 · ", "")})을 지킬게요</span>
          <span className="mt-1 block text-xs text-faint">동의해야 수락할 수 있어요. 데이터는 협업이 확정된 뒤 이 조건에 맞춰 받아요.</span>
        </span>
      </label>
      <textarea
        value={reply}
        onChange={(event) => setReply(event.target.value.slice(0, LIMITS.reply))}
        placeholder={adjusting ? "기간을 조정한 이유를 남겨 주세요 (선택) 예) 11월 첫 주까지 다른 일정이 있어요" : "수락하면서 연구자에게 한마디 남기기 (선택)"}
        rows={2}
        className={`${INPUT_CLASS} h-auto py-3`}
      />
      {error && <p className="text-[13px] text-danger">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => setRejecting(true)} disabled={busy} className="h-11 rounded-button border border-line px-5 text-sm font-semibold text-muted hover:bg-page">
          거절
        </button>
        <button type="button" onClick={accept} disabled={!agreed || !periodOk || busy} className="h-11 rounded-button bg-brand px-6 text-sm font-semibold text-white hover:bg-brand-hover disabled:opacity-40">
          {busy ? "수락하는 중…" : request.is_urgent ? "수락하고 바로 시작하기" : adjusting ? "조정한 기간으로 수락하기" : "수락하기"}
        </button>
      </div>
      {rejecting && <RejectModal nickname={request.researcher.nickname} onClose={() => setRejecting(false)} onReject={onReject} />}
    </div>
  );
}

function Choice({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`h-10 rounded-button border px-3 text-[13px] ${on ? "border-brand bg-brand-soft font-semibold text-brand" : "border-line text-muted hover:bg-page"}`}
    >
      {children}
    </button>
  );
}

/** [수락 취소] 창. 이유는 필수이고 연구자에게 전달돼요. */
function WithdrawModal({ nickname, onClose, onWithdraw }: { nickname: string; onClose: () => void; onWithdraw: (text: string) => Promise<void> }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setBusy(true);
    setError("");
    try {
      await onWithdraw(text.trim());
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "잠시 후 다시 시도해 주세요");
      setBusy(false);
    }
  }

  return (
    <Modal
      title="수락을 취소할까요?"
      description={`이유는 ${nickname} 님에게 전달돼요. 취소하면 이 연구로는 다시 요청을 받지 않아요.`}
      onClose={onClose}
      footer={
        <div className="flex items-center justify-end gap-2">
          {error && <p className="mr-auto text-[13px] text-danger">{error}</p>}
          <button type="button" onClick={onClose} disabled={busy} className="h-10 rounded-button border border-line px-4 text-sm font-semibold text-muted">
            아니요
          </button>
          <button type="button" onClick={submit} disabled={!text.trim() || busy} className="h-10 rounded-button bg-danger px-5 text-sm font-semibold text-white disabled:opacity-40">
            {busy ? "취소하는 중…" : "수락 취소하기"}
          </button>
        </div>
      }
    >
      <textarea
        value={text}
        onChange={(event) => setText(event.target.value.slice(0, LIMITS.withdrawText))}
        placeholder="예) 갑자기 다른 일정이 생겨 이 기간에는 어려워졌어요"
        rows={3}
        className={`${INPUT_CLASS} h-auto py-3`}
      />
      <p className="mt-1 text-right text-xs text-faint">
        {text.length} / {LIMITS.withdrawText} · 필수
      </p>
    </Modal>
  );
}

function pastText(request: ReceivedRequest): string {
  const when = formatDate(request.responded_at ?? request.created_at);
  switch (request.status) {
    case "started":
      return "협업이 시작됐어요. 협업 공간에서 이어서 진행해요.";
    case "rejected": {
      const reason = request.reject_text || (request.reject_reason ? REJECT_REASON_LABELS[request.reject_reason] : "");
      return `${when}에 거절했어요${reason ? ` · “${reason}”` : ""}`;
    }
    case "expired":
      return request.responded_at
        ? "수락했지만 연구자가 기한 안에 협업을 시작하지 않아 만료됐어요."
        : `${deadlineText(request.expires_at)}에 만료됐어요. 기한 안에 답하지 않았어요.`;
    default:
      return {
        withdrawn: "연구자가 요청을 취소했어요.",
        declined: "연구자가 이번 협업은 진행하지 않기로 했어요.",
        expert_withdrew: `수락을 취소했어요${request.cancel_text ? ` · “${request.cancel_text}”` : ""}`,
        other_started: "이 연구의 협업 인원이 다 차서 요청이 닫혔어요.",
      }[request.cancel_reason ?? "withdrawn"];
  }
}

/** [거절] 확인 창. 사유를 고르면 연구자에게 함께 전달돼요. */
function RejectModal({
  nickname,
  onClose,
  onReject,
}: {
  nickname: string;
  onClose: () => void;
  onReject: (reason: RejectReason, text: string) => Promise<void>;
}) {
  const [reason, setReason] = useState<RejectReason | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (!reason) return;
    setBusy(true);
    setError("");
    try {
      await onReject(reason, text.trim());
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "잠시 후 다시 시도해 주세요");
      setBusy(false);
    }
  }

  return (
    <Modal
      title="이 요청을 거절할까요?"
      description={`거절 사유는 ${nickname} 님에게 전달돼요. 다른 사람에게는 보이지 않아요.`}
      onClose={onClose}
      footer={
        <div className="flex items-center justify-end gap-2">
          {error && <p className="mr-auto text-[13px] text-danger">{error}</p>}
          <button type="button" onClick={onClose} disabled={busy} className="h-10 rounded-button border border-line px-4 text-sm font-semibold text-muted">
            취소
          </button>
          <button type="button" onClick={submit} disabled={!reason || busy} className="h-10 rounded-button bg-danger px-5 text-sm font-semibold text-white disabled:opacity-40">
            {busy ? "거절하는 중…" : "거절하기"}
          </button>
        </div>
      }
    >
      <fieldset className="space-y-2">
        <legend className="sr-only">거절 사유</legend>
        {(Object.keys(REJECT_REASON_LABELS) as RejectReason[]).map((code) => (
          <label key={code} className={`flex cursor-pointer items-center gap-3 rounded-button border px-4 py-3 text-sm ${reason === code ? "border-brand bg-brand-soft" : "border-line"}`}>
            <input type="radio" name="reject-reason" checked={reason === code} onChange={() => setReason(code)} className="accent-brand" />
            {REJECT_REASON_LABELS[code]}
          </label>
        ))}
      </fieldset>
      <textarea
        value={text}
        onChange={(event) => setText(event.target.value.slice(0, LIMITS.rejectText))}
        placeholder="연구자에게 전할 말 (선택)"
        rows={3}
        className={`${INPUT_CLASS} mt-4 h-auto py-3`}
      />
      <p className="mt-1 text-right text-xs text-faint">
        {text.length} / {LIMITS.rejectText} · 선택
      </p>
    </Modal>
  );
}

function meetingText(type: "online" | "offline_ok", area: string | null): string {
  return type === "offline_ok" ? `대면 가능 · ${area ?? ""}` : MEETING_LABELS[type];
}

function Section({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="border-b border-line p-5">
      {title && <h3 className="mb-3 text-sm font-bold">{title}</h3>}
      {children}
    </section>
  );
}

function InfoGrid({ children }: { children: ReactNode }) {
  return <dl className="grid gap-4 sm:grid-cols-3">{children}</dl>;
}

function Info({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div>
      <dt className="text-xs text-faint">{label}</dt>
      <dd className="mt-1 text-sm font-medium">{value || <span className="text-faint">적지 않음</span>}</dd>
      {note && <dd className="mt-1 text-xs text-muted">{note}</dd>}
    </div>
  );
}

function Notice({ tone, children }: { tone: "success" | "muted"; children: ReactNode }) {
  return (
    <p className={`rounded-b-card px-5 py-4 text-sm ${tone === "success" ? "bg-success-soft text-success" : "bg-page text-muted"}`}>{children}</p>
  );
}

function EmptyTab({ tab }: { tab: Tab }) {
  const text = {
    new: ["새 요청이 없어요", "내 이력을 공개해 두면 연구자가 요청을 보낼 수 있어요."],
    waiting: ["연구자 선택을 기다리는 요청이 없어요", "수락한 요청은 연구자가 협업 시작을 고를 때까지 여기에 있어요."],
    past: ["지난 요청이 없어요", "거절·만료되거나 협업이 시작된 요청이 여기에 모여요."],
  }[tab];
  return (
    <div className="mt-5 rounded-card border border-dashed border-line px-6 py-14 text-center">
      <p className="font-semibold">{text[0]}</p>
      <p className="mt-2 text-sm text-muted">{text[1]}</p>
    </div>
  );
}

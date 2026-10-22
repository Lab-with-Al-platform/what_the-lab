"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ApiError, requestApi } from "@/lib/api";
import {
  daysLeft,
  formatPeriod,
  photoOrDefault,
  REJECT_REASON_LABELS,
  SentRequest,
  shortDate,
} from "@/lib/collab-requests";
import { formatDate, MEETING_LABELS, Research } from "@/lib/my-research";
import type { AbleWorkOption, FieldCategory } from "@/components/my-research-modal";
import { Modal } from "@/components/modal";
import { Avatar, StatusBadge, Tabs } from "@/components/request-parts";

type Tab = "waiting" | "accepted" | "closed";

const TAB_HELP: Record<Tab, string> = {
  waiting: "요청을 취소하면 목록에서 사라져요. 다시 보내고 싶으면 그 전문가 상세에서 다시 요청하면 돼요.",
  accepted: "협업을 시작하면 협업 공간과 디스코드 채널이 만들어지고, 이 연구로 보낸 다른 요청은 자동으로 취소돼요.",
  closed: "만료된 요청은 다시 보낼 수 있어요. 거절한 전문가에게는 같은 연구로 다시 보낼 수 없어요.",
};

const OPEN_STATUSES = new Set(["pending", "accepted"]); // 아직 진행 중인 요청

/** 연구회원 '요청관리'. 지정한 연구로 보낸 요청을 상태별 탭으로 보여 줘요. */
export function SentRequests() {
  const [researches, setResearches] = useState<Research[] | null>(null);
  const [requests, setRequests] = useState<SentRequest[]>([]);
  const [names, setNames] = useState<{ works: Map<string, string>; fields: Map<string, string> }>({ works: new Map(), fields: new Map() });
  const [loadError, setLoadError] = useState("");
  const [tab, setTab] = useState<Tab>("waiting");
  const [picking, setPicking] = useState(false);
  const [starting, setStarting] = useState<SentRequest | null>(null);
  const [startedWith, setStartedWith] = useState(""); // 방금 협업을 시작한 전문가
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    Promise.all([
      requestApi<Research[]>("/researcher/researches"),
      requestApi<SentRequest[]>("/researcher/requests"),
      requestApi<AbleWorkOption[]>("/expert/able-works"),
      requestApi<FieldCategory[]>("/taxonomy/fields"),
    ])
      .then(([loadedResearches, loadedRequests, works, fields]) => {
        setResearches(loadedResearches);
        setRequests(loadedRequests);
        setNames({
          works: new Map(works.map((work) => [work.able_work_id, work.name])),
          fields: new Map(fields.flatMap((category) => category.fields.map((field) => [field.field_id, field.name]))),
        });
      })
      .catch((error) => setLoadError(error instanceof ApiError ? error.message : "잠시 후 다시 시도해 주세요"));
  }, []);

  if (loadError) return <p className="py-20 text-center text-sm text-danger">{loadError}</p>;
  if (!researches) return <p className="py-20 text-center text-sm text-faint">불러오는 중…</p>;

  const primary = researches.find((research) => research.is_primary);
  const mine = requests.filter((request) => request.research_id === primary?.research_id);
  const lists: Record<Tab, SentRequest[]> = {
    waiting: mine.filter((request) => request.status === "pending"),
    accepted: mine.filter((request) => request.status === "accepted"),
    closed: mine.filter((request) => request.status === "rejected" || request.status === "expired"),
  };
  // 다른 연구로 보낸 요청 중 아직 진행 중인 것 (안내 줄에 보여 줘요)
  const otherOpen = requests.filter((request) => request.research_id !== primary?.research_id && OPEN_STATUSES.has(request.status));
  const otherTitle = researches.find((research) => research.research_id === otherOpen[0]?.research_id)?.title ?? "";

  /** 요청 상태를 바꾸는 API. 백엔드가 돌려준 최신 목록으로 다시 그려요. */
  async function act(requestId: number, action: "cancel" | "decline" | "resend" | "start") {
    setActionError("");
    try {
      setRequests(await requestApi<SentRequest[]>(`/researcher/requests/${requestId}/${action}`, { method: "POST" }));
    } catch (error) {
      setActionError(error instanceof ApiError ? error.message : "잠시 후 다시 시도해 주세요");
      throw error;
    }
  }

  async function pick(researchId: number) {
    setResearches(await requestApi<Research[]>(`/researcher/researches/${researchId}/primary`, { method: "PUT" }));
    setPicking(false);
    setTab("waiting");
  }

  return (
    <div>
      <h1 className="text-[28px] font-bold">요청관리</h1>
      <p className="mt-1 text-sm text-muted">지정한 연구로 보낸 요청이에요. 연구를 바꾸면 아래 목록도 바뀌어요.</p>

      {!primary ? (
        <NoPrimary hasRegistered={researches.some((research) => research.status === "registered")} onPick={() => setPicking(true)} />
      ) : (
        <>
          <PrimaryCard research={primary} sentCount={mine.length} names={names} onChange={() => setPicking(true)} />

          {otherOpen.length > 0 && (
            <div className="mt-3 flex items-center gap-3 rounded-button bg-brand-soft px-4 py-3 text-[13px] text-brand">
              <span className="min-w-0 flex-1 truncate">
                다른 연구({otherTitle})에 답 기다리는 요청이 {otherOpen.length}개 있어요
              </span>
              <button type="button" onClick={() => setPicking(true)} className="shrink-0 font-bold underline">
                보기
              </button>
            </div>
          )}

          {startedWith && (
            <p className="mt-3 rounded-button bg-success-soft px-4 py-3 text-sm font-semibold text-success">
              {startedWith} 님과 협업을 시작했어요.{" "}
              <Link href="/workspace" className="underline">
                협업 공간으로 가기
              </Link>
            </p>
          )}

          <div className="mt-6">
            <Tabs
              current={tab}
              onChange={setTab}
              tabs={[
                { key: "waiting", label: "답 기다리는 중", count: lists.waiting.length },
                { key: "accepted", label: "수락됨 · 확정 필요", short: "확정 필요", count: lists.accepted.length, dot: lists.accepted.length > 0 },
                { key: "closed", label: "거절 · 만료", short: "거절·만료", count: lists.closed.length },
              ]}
            />
          </div>
          <p className="mt-4 text-[13px] text-faint">{TAB_HELP[tab]}</p>
          {actionError && <p className="mt-2 text-[13px] text-danger">{actionError}</p>}

          {lists[tab].length === 0 ? (
            <EmptyTab tab={tab} />
          ) : (
            <ul className="mt-3 space-y-3">
              {lists[tab].map((request) => (
                <SentCard key={request.request_id} request={request} onAct={(action) => act(request.request_id, action)} onStart={() => setStarting(request)} />
              ))}
            </ul>
          )}
        </>
      )}

      {picking && <PickResearch researches={researches} requests={requests} onPick={pick} onClose={() => setPicking(false)} />}
      {starting && primary && (
        <StartConfirm
          request={starting}
          research={primary}
          others={mine.filter((request) => request.request_id !== starting.request_id && OPEN_STATUSES.has(request.status))}
          onClose={() => setStarting(null)}
          onConfirm={async () => {
            await act(starting.request_id, "start");
            setStartedWith(starting.expert.nickname);
            setStarting(null);
          }}
        />
      )}
    </div>
  );
}

type Names = { works: Map<string, string>; fields: Map<string, string> };

/** 맨 위: 지금 지정한 연구 */
function PrimaryCard({ research, sentCount, names, onChange }: { research: Research; sentCount: number; names: Names; onChange: () => void }) {
  const works = research.task_unsure ? ["잘 모르겠어요"] : research.able_work_ids.map((id) => names.works.get(id) ?? id);
  return (
    <section className="mt-6 flex flex-col gap-4 rounded-card border border-line bg-card p-5 shadow-card sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="rounded-full bg-brand px-2.5 py-0.5 text-[11px] font-bold text-white">지정한 연구</span>
          {research.field_ids.map((id) => (
            <span key={id} className="rounded-full bg-researcher-soft px-2.5 py-0.5 text-[11px] font-semibold text-researcher">
              {names.fields.get(id) ?? id}
            </span>
          ))}
        </div>
        <p className="mt-2 font-bold leading-snug">{research.title}</p>
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-faint">
          맡길 일
          {works.map((work) => (
            <span key={work} className="rounded-full bg-brand-soft px-2 py-0.5 text-brand">
              {work}
            </span>
          ))}
          <span className="ml-1">· {sentCount}명에게 보냄</span>
        </div>
      </div>
      <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
        <button type="button" onClick={onChange} className="h-10 rounded-button border border-line px-4 text-[13px] font-semibold text-muted hover:bg-page">
          다른 연구로 바꾸기
        </button>
        <Link href="/experts" className="inline-flex h-10 items-center justify-center rounded-button bg-brand px-4 text-[13px] font-semibold text-white hover:bg-brand-hover">
          이 연구로 전문가 더 찾기
        </Link>
      </div>
    </section>
  );
}

/** 요청 한 장. 상태마다 보이는 줄과 버튼이 달라요. */
function SentCard({
  request,
  onAct,
  onStart,
}: {
  request: SentRequest;
  onAct: (action: "cancel" | "decline" | "resend") => Promise<void>;
  onStart: () => void;
}) {
  const [showSent, setShowSent] = useState(false); // [보낸 내용] 펼침
  const [confirm, setConfirm] = useState<"cancel" | "decline" | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(action: "cancel" | "decline" | "resend") {
    setBusy(true);
    try {
      await onAct(action);
    } catch {
      setBusy(false); // 실패하면 버튼을 다시 살려요 (성공하면 카드가 목록에서 바뀌어요)
    }
  }

  const { status } = request;
  const badge = {
    pending: <StatusBadge tone="brand">답 기다리는 중</StatusBadge>,
    accepted: <StatusBadge tone="success">수락함 · 확정 필요</StatusBadge>,
    expired: <StatusBadge tone="muted">만료됨</StatusBadge>,
    rejected: <StatusBadge tone="danger">거절됨</StatusBadge>,
  }[status as "pending" | "accepted" | "expired" | "rejected"];

  return (
    <li className="rounded-card border border-line bg-card p-5 shadow-card">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <Avatar src={photoOrDefault(request.expert.user_photo, "expert")} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-bold">{request.expert.nickname}</p>
              {badge}
            </div>
            <p className="mt-1 text-xs text-faint">{statusLine(request)}</p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {(status === "pending" || status === "rejected") && (
            <SmallButton onClick={() => setShowSent((value) => !value)}>{showSent ? "접기" : "보낸 내용"}</SmallButton>
          )}
          {status === "pending" && <SmallButton onClick={() => setConfirm("cancel")}>요청 취소</SmallButton>}
          {status === "accepted" && (
            <>
              <SmallButton onClick={() => setConfirm("decline")}>거절</SmallButton>
              <button type="button" onClick={onStart} className="h-9 rounded-button bg-brand px-4 text-[13px] font-semibold text-white hover:bg-brand-hover">
                협업 시작하기
              </button>
            </>
          )}
          {status === "expired" && (
            <SmallButton onClick={() => run("resend")} disabled={busy}>
              다시 보내기
            </SmallButton>
          )}
        </div>
      </div>

      {status === "accepted" && (
        <div className="mt-4 space-y-2 border-t border-line pt-4">
          <p className="text-[13px] font-semibold text-success">✓ 데이터 공유 조건에 동의했어요</p>
          {request.reply_message && <p className="rounded-button bg-page px-4 py-3 text-sm text-muted">“{request.reply_message}”</p>}
        </div>
      )}

      {showSent && (
        <dl className="mt-4 grid gap-3 border-t border-line pt-4 text-sm sm:grid-cols-[80px_1fr]">
          <dt className="text-xs text-faint">희망 기간</dt>
          <dd>{formatPeriod(request.start_date, request.end_date)}</dd>
          <dt className="text-xs text-faint">메시지</dt>
          <dd className="whitespace-pre-line">{request.message}</dd>
        </dl>
      )}

      {confirm && (
        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-button bg-danger-soft px-4 py-3">
          <p className="mr-auto text-[13px] font-semibold text-danger">
            {confirm === "cancel" ? "이 요청을 취소할까요? 목록에서 사라져요." : "수락한 요청을 거절할까요? 되돌릴 수 없어요."}
          </p>
          <SmallButton onClick={() => setConfirm(null)} disabled={busy}>
            아니요
          </SmallButton>
          <button type="button" onClick={() => run(confirm)} disabled={busy} className="h-9 rounded-button bg-danger px-4 text-[13px] font-semibold text-white disabled:opacity-60">
            {confirm === "cancel" ? "요청 취소" : "거절하기"}
          </button>
        </div>
      )}
    </li>
  );
}

/** 상태별 설명 한 줄 */
function statusLine(request: SentRequest): string {
  const sent = formatDate(request.created_at);
  switch (request.status) {
    case "pending":
      return `${sent} 보냄 · ${formatDate(request.expires_at)}까지 답이 없으면 만료 (${daysLeft(request.expires_at)}일 남음)`;
    case "accepted":
      return `${formatDate(request.responded_at ?? request.created_at)} 수락 · 희망 기간 ${shortDate(request.start_date)} ~ ${shortDate(request.end_date)}`;
    case "expired":
      return `${sent} 보냄 · ${formatDate(request.expires_at)} 만료 (7일 동안 답이 없었어요)`;
    case "rejected": {
      const reason = request.reject_text || (request.reject_reason ? REJECT_REASON_LABELS[request.reject_reason] : "");
      return `${formatDate(request.responded_at ?? request.created_at)} 거절${reason ? ` · “${reason}”` : ""}`;
    }
    default:
      return sent;
  }
}

/** [협업 시작하기] 확인 창. 확정하면 되돌릴 수 없어서 한 번 더 확인해요. */
function StartConfirm({
  request,
  research,
  others,
  onClose,
  onConfirm,
}: {
  request: SentRequest;
  research: Research;
  others: SentRequest[];
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const meeting =
    research.meeting_type === "offline_ok" ? `대면 가능 · ${research.face_to_area ?? ""}` : research.meeting_type ? MEETING_LABELS[research.meeting_type] : "정하지 않음";

  async function confirm() {
    setBusy(true);
    try {
      await onConfirm();
    } catch {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={`${request.expert.nickname} 님과 협업을 시작할까요?`}
      description="시작하면 아래 일이 한 번에 진행돼요."
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <SmallButton onClick={onClose} disabled={busy}>
            취소
          </SmallButton>
          <button type="button" onClick={confirm} disabled={busy} className="h-10 rounded-button bg-brand px-5 text-sm font-semibold text-white disabled:opacity-60">
            {busy ? "시작하는 중…" : "협업 시작하기"}
          </button>
        </div>
      }
    >
      <dl className="grid gap-3 rounded-card border border-line p-4 text-sm sm:grid-cols-[100px_1fr]">
        <dt className="text-xs text-faint">연구</dt>
        <dd className="font-medium">{research.title}</dd>
        <dt className="text-xs text-faint">함께할 전문가</dt>
        <dd className="font-medium">{request.expert.nickname}</dd>
        <dt className="text-xs text-faint">기간</dt>
        <dd className="font-medium">{formatPeriod(request.start_date, request.end_date)}</dd>
        <dt className="text-xs text-faint">미팅 방식</dt>
        <dd className="font-medium">{meeting}</dd>
      </dl>
      <ul className="mt-4 space-y-2 text-sm text-muted">
        <li>• 협업 공간이 만들어지고, 디스코드에 두 사람만 있는 협업 채널이 만들어져요</li>
        {others.length > 0 && <li>• 같은 연구로 보낸 {others.map((other) => other.expert.nickname).join(", ")} 님 요청은 자동으로 취소돼요</li>}
      </ul>
    </Modal>
  );
}

/** [다른 연구로 바꾸기]: 등록한 연구 중 하나를 지정해요. */
function PickResearch({
  researches,
  requests,
  onPick,
  onClose,
}: {
  researches: Research[];
  requests: SentRequest[];
  onPick: (researchId: number) => Promise<void>;
  onClose: () => void;
}) {
  const [error, setError] = useState("");
  const registered = researches.filter((research) => research.status === "registered");

  function summary(researchId: number): string {
    const sent = requests.filter((request) => request.research_id === researchId && request.status !== "canceled");
    if (sent.length === 0) return "아직 보낸 요청 없음";
    const accepted = sent.filter((request) => request.status === "accepted").length;
    const pending = sent.filter((request) => request.status === "pending").length;
    const detail = accepted ? ` · 확정 필요 ${accepted}` : pending ? ` · 답 기다리는 중 ${pending}` : "";
    return `${sent.length}명에게 보냄${detail}`;
  }

  async function choose(researchId: number) {
    setError("");
    try {
      await onPick(researchId);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "잠시 후 다시 시도해 주세요");
    }
  }

  return (
    <Modal title="지정할 연구 고르기" description="고른 연구가 지정되고, 보낸 요청 목록도 그 연구로 바뀌어요." onClose={onClose} footer={<p className="text-[13px] text-danger">{error}</p>}>
      <ul className="space-y-2">
        {registered.map((research) => (
          <li key={research.research_id}>
            <button
              type="button"
              onClick={() => choose(research.research_id)}
              className={`w-full rounded-card border p-4 text-left hover:border-brand ${research.is_primary ? "border-brand bg-brand-soft" : "border-line"}`}
            >
              <p className="font-semibold">{research.title}</p>
              <p className="mt-1 text-xs text-faint">
                {research.is_primary ? "지금 지정한 연구 · " : ""}
                {summary(research.research_id)}
              </p>
            </button>
          </li>
        ))}
      </ul>
    </Modal>
  );
}

function NoPrimary({ hasRegistered, onPick }: { hasRegistered: boolean; onPick: () => void }) {
  return (
    <div className="mt-8 rounded-card border border-dashed border-line px-6 py-14 text-center">
      <p className="font-semibold">{hasRegistered ? "지정한 연구가 없어요" : "아직 등록한 연구가 없어요"}</p>
      <p className="mt-2 text-sm text-muted">협업 요청은 지정한 연구로 보내요. 먼저 연구를 {hasRegistered ? "지정해" : "등록해"} 주세요.</p>
      {hasRegistered ? (
        <button type="button" onClick={onPick} className="mt-5 h-10 rounded-button bg-brand px-5 text-sm font-semibold text-white">
          연구 지정하기
        </button>
      ) : (
        <Link href="/my-research" className="mt-5 inline-flex h-10 items-center rounded-button bg-brand px-5 text-sm font-semibold text-white">
          내 연구로 가기
        </Link>
      )}
    </div>
  );
}

function EmptyTab({ tab }: { tab: Tab }) {
  const text = {
    waiting: "답을 기다리는 요청이 없어요",
    accepted: "수락된 요청이 없어요",
    closed: "거절되거나 만료된 요청이 없어요",
  }[tab];
  return (
    <div className="mt-3 rounded-card border border-dashed border-line px-6 py-12 text-center">
      <p className="text-sm font-semibold">{text}</p>
      {tab === "waiting" && (
        <Link href="/experts" className="mt-4 inline-flex h-10 items-center rounded-button border border-line px-4 text-[13px] font-semibold text-muted hover:bg-page">
          AI 전문가 찾으러 가기
        </Link>
      )}
    </div>
  );
}

function SmallButton({ onClick, disabled, children }: { onClick: () => void; disabled?: boolean; children: string }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="h-9 rounded-button border border-line bg-card px-3 text-[13px] font-semibold text-muted hover:bg-page disabled:opacity-50">
      {children}
    </button>
  );
}
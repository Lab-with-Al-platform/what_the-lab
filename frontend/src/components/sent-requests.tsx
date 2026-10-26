"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ApiError, requestApi } from "@/lib/api";
import {
  closedByMe,
  deadlineText,
  effectivePeriod,
  formatPeriod,
  photoOrDefault,
  REJECT_REASON_LABELS,
  RULES,
  secondTryBlock,
  SentRequest,
  shortPeriod,
  timeLeft,
  todayDate,
} from "@/lib/collab-requests";
import { formatDate, MEETING_LABELS, Research } from "@/lib/my-research";
import type { AbleWorkOption, FieldCategory } from "@/components/my-research-modal";
import { Modal } from "@/components/modal";
import { Avatar, StatusBadge, Tabs } from "@/components/request-parts";

type Tab = "waiting" | "accepted" | "closed";
type Action = "cancel" | "decline" | "start";

const TAB_HELP: Record<Tab, string> = {
  waiting: "답 기한이 지나면 자동으로 만료돼요. 취소하거나 답 없이 만료된 전문가에게는 이 연구로 한 번 더 보낼 수 있어요.",
  accepted: `수락한 전문가와 각각 협업을 시작할 수 있어요. 한 연구로 ${RULES.maxActive}명까지 함께할 수 있고, 선택 기한이 지나면 자동으로 만료돼요.`,
  closed: "거절·수락 취소된 전문가에게는 이 연구로 다시 보낼 수 없어요. 답 없이 만료된 요청은 한 번 더 보낼 수 있어요.",
};

/** 연구회원 '요청관리'. 지정한 연구로 보낸 요청을 상태별 탭으로 보여 줘요. */
export function SentRequests() {
  const [researches, setResearches] = useState<Research[] | null>(null);
  const [requests, setRequests] = useState<SentRequest[]>([]);
  const [names, setNames] = useState<{ works: Map<string, string>; fields: Map<string, string> }>({ works: new Map(), fields: new Map() });
  const [loadError, setLoadError] = useState("");
  const [tab, setTab] = useState<Tab>("waiting");
  const [picking, setPicking] = useState(false);
  const [starting, setStarting] = useState<SentRequest | null>(null);
  const [closing, setClosing] = useState(false); // [더 안 받기] 확인 창
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
  const all = requests.filter((request) => request.research_id === primary?.research_id); // 내가 닫은 요청 포함
  const mine = all.filter((request) => !closedByMe(request));
  const lists: Record<Tab, SentRequest[]> = {
    waiting: mine.filter((request) => request.status === "pending"),
    accepted: mine.filter((request) => request.status === "accepted"),
    closed: mine.filter((request) => request.status === "rejected" || request.status === "expired" || request.status === "canceled"),
  };
  const today = todayDate();
  const active = mine.filter((request) => request.status === "started" && effectivePeriod(request).end >= today);
  const openCount = lists.waiting.length + lists.accepted.length;
  // 다른 연구로 보낸 요청 중 아직 진행 중인 것 (안내 줄에 보여 줘요)
  const otherOpen = requests.filter(
    (request) => request.research_id !== primary?.research_id && (request.status === "pending" || request.status === "accepted"),
  );
  const otherTitle = researches.find((research) => research.research_id === otherOpen[0]?.research_id)?.title ?? "";

  /** 백엔드가 돌려준 최신 목록으로 다시 그려요. 실패하면 문구를 보여 주고 버튼을 다시 살려요. */
  async function run(task: () => Promise<SentRequest[]>) {
    setActionError("");
    try {
      setRequests(await task());
    } catch (error) {
      setActionError(error instanceof ApiError ? error.message : "잠시 후 다시 시도해 주세요");
      throw error;
    }
  }

  const act = (requestId: number, action: Action) =>
    run(() => requestApi<SentRequest[]>(`/researcher/requests/${requestId}/${action}`, { method: "POST" }));

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
          <PrimaryCard
            research={primary}
            sentCount={mine.length}
            activeCount={active.length}
            openCount={openCount}
            names={names}
            onChange={() => setPicking(true)}
            onClose={() => setClosing(true)}
          />

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
                { key: "accepted", label: "수락됨 · 선택 필요", short: "선택 필요", count: lists.accepted.length, dot: lists.accepted.length > 0 },
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
                <SentCard
                  key={request.request_id}
                  request={request}
                  canTryAgain={!secondTryBlock(all.filter((item) => item.expert.user_id === request.expert.user_id))}
                  slotsFull={active.length >= RULES.maxActive}
                  onAct={(action) => act(request.request_id, action)}
                  onStart={() => setStarting(request)}
                />
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
          activeCount={active.length}
          others={mine.filter((request) => request.request_id !== starting.request_id && (request.status === "pending" || request.status === "accepted"))}
          onClose={() => setStarting(null)}
          onConfirm={async () => {
            await act(starting.request_id, "start");
            setStartedWith(starting.expert.nickname);
            setStarting(null);
          }}
        />
      )}
      {closing && primary && (
        <CloseConfirm
          waiting={lists.waiting.length}
          accepted={lists.accepted.length}
          onClose={() => setClosing(false)}
          onConfirm={async () => {
            await run(() => requestApi<SentRequest[]>("/researcher/requests/close", { method: "POST", body: JSON.stringify({ research_id: primary.research_id }) }));
            setClosing(false);
          }}
        />
      )}
    </div>
  );
}

type Names = { works: Map<string, string>; fields: Map<string, string> };

/** 맨 위: 지금 지정한 연구 */
function PrimaryCard({
  research,
  sentCount,
  activeCount,
  openCount,
  names,
  onChange,
  onClose,
}: {
  research: Research;
  sentCount: number;
  activeCount: number; // 이 연구로 진행 중인 협업 수
  openCount: number; // 답 기다리는·수락된 요청 수
  names: Names;
  onChange: () => void;
  onClose: () => void;
}) {
  const works = research.task_unsure ? ["잘 모르겠어요"] : research.able_work_ids.map((id) => names.works.get(id) ?? id);
  const full = activeCount >= RULES.maxActive;
  return (
    <section className="mt-6 rounded-card border border-line bg-card p-5 shadow-card">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
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
          {!full && (
            <Link href="/experts" className="inline-flex h-10 items-center justify-center rounded-button bg-brand px-4 text-[13px] font-semibold text-white hover:bg-brand-hover">
              이 연구로 전문가 더 찾기
            </Link>
          )}
        </div>
      </div>
      {/* 협업 인원과 [더 안 받기] */}
      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-line pt-3 text-[13px]">
        <span className="text-muted">
          진행 중인 협업 <b className={full ? "text-danger" : "text-ink"}>{activeCount}</b> / {RULES.maxActive}명
          {full && " · 협업 인원이 다 찼어요"}
        </span>
        {openCount > 0 && (
          <button type="button" onClick={onClose} className="ml-auto font-semibold text-muted underline hover:text-ink">
            이 연구로 더 안 받기
          </button>
        )}
      </div>
    </section>
  );
}

/** 요청 한 장. 상태마다 보이는 줄과 버튼이 달라요. */
function SentCard({
  request,
  canTryAgain,
  slotsFull,
  onAct,
  onStart,
}: {
  request: SentRequest;
  canTryAgain: boolean; // 이 전문가에게 이 연구로 한 번 더 보낼 수 있는지
  slotsFull: boolean; // 진행 중 협업이 3개라 더 시작할 수 없는지
  onAct: (action: "cancel" | "decline") => Promise<void>;
  onStart: () => void;
}) {
  const [showSent, setShowSent] = useState(false); // [보낸 내용] 펼침
  const [confirm, setConfirm] = useState<"cancel" | "decline" | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(action: "cancel" | "decline") {
    setBusy(true);
    try {
      await onAct(action);
    } catch {
      setBusy(false); // 실패하면 버튼을 다시 살려요 (성공하면 카드가 목록에서 바뀌어요)
    }
  }

  const { status } = request;
  const period = effectivePeriod(request);
  const badge = {
    pending: <StatusBadge tone="brand">답 기다리는 중</StatusBadge>,
    accepted: period.adjusted ? <StatusBadge tone="success">기간 조정해서 수락</StatusBadge> : <StatusBadge tone="success">수락함 · 선택 필요</StatusBadge>,
    expired: <StatusBadge tone="muted">만료됨</StatusBadge>,
    rejected: <StatusBadge tone="danger">거절됨</StatusBadge>,
    canceled: <StatusBadge tone="muted">{request.cancel_reason === "expert_withdrew" ? "수락 취소됨" : "닫힘"}</StatusBadge>,
    started: <StatusBadge tone="success">협업 중</StatusBadge>,
  }[status];

  return (
    <li className={`rounded-card border bg-card p-5 shadow-card ${request.is_urgent && status === "pending" ? "border-danger/40" : "border-line"}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <Avatar src={photoOrDefault(request.expert.user_photo, "expert")} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-bold">{request.expert.nickname}</p>
              {request.is_urgent && <StatusBadge tone="danger">🔥 급해요</StatusBadge>}
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
              <button
                type="button"
                onClick={onStart}
                disabled={slotsFull}
                title={slotsFull ? "진행 중인 협업이 3개라 더 시작할 수 없어요" : undefined}
                className="h-9 rounded-button bg-brand px-4 text-[13px] font-semibold text-white hover:bg-brand-hover disabled:opacity-40"
              >
                {period.adjusted ? "이 기간으로 협업 시작" : "협업 시작하기"}
              </button>
            </>
          )}
          {(status === "expired" || status === "canceled") && canTryAgain && (
            <Link href={`/experts/${request.expert.user_id}`} className="inline-flex h-9 items-center rounded-button border border-brand px-3 text-[13px] font-semibold text-brand hover:bg-brand-soft">
              한 번 더 요청하기
            </Link>
          )}
        </div>
      </div>

      {status === "accepted" && (
        <div className="mt-4 space-y-2 border-t border-line pt-4">
          {period.adjusted && (
            <dl className="grid gap-2 rounded-button bg-page px-4 py-3 text-sm sm:grid-cols-[90px_1fr]">
              <dt className="text-xs text-faint">요청한 기간</dt>
              <dd className="text-muted line-through">{formatPeriod(request.start_date, request.end_date)}</dd>
              <dt className="text-xs text-faint">조정한 기간</dt>
              <dd className="font-semibold">{formatPeriod(period.start, period.end)}</dd>
            </dl>
          )}
          <p className="text-[13px] font-semibold text-success">✓ 데이터 공유 조건에 동의했어요</p>
          {request.reply_message && <p className="rounded-button bg-page px-4 py-3 text-sm text-muted">“{request.reply_message}”</p>}
          {request.select_expires_at && (
            <p className="text-[13px] font-semibold text-danger">
              {deadlineText(request.select_expires_at)}까지 협업을 시작하거나 거절해 주세요 ({timeLeft(request.select_expires_at)})
            </p>
          )}
          {slotsFull && <p className="text-[13px] text-muted">진행 중인 협업이 {RULES.maxActive}개라 더 시작할 수 없어요.</p>}
        </div>
      )}

      {status === "canceled" && request.cancel_reason === "expert_withdrew" && request.cancel_text && (
        <p className="mt-4 rounded-button bg-page px-4 py-3 text-sm text-muted">수락 취소 이유: “{request.cancel_text}”</p>
      )}

      {showSent && (
        <dl className="mt-4 grid gap-3 border-t border-line pt-4 text-sm sm:grid-cols-[80px_1fr]">
          <dt className="text-xs text-faint">희망 기간</dt>
          <dd>{formatPeriod(request.start_date, request.end_date)}</dd>
          <dt className="text-xs text-faint">메시지</dt>
          <dd className="whitespace-pre-line">{request.message || "메시지를 적지 않았어요"}</dd>
        </dl>
      )}

      {confirm && (
        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-button bg-danger-soft px-4 py-3">
          <p className="mr-auto text-[13px] font-semibold text-danger">
            {confirm === "cancel"
              ? "이 요청을 취소할까요? 이 전문가에게는 이 연구로 한 번 더 보낼 수 있어요."
              : "수락한 요청을 거절할까요? 이 전문가에게는 이 연구로 다시 보낼 수 없어요."}
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
  const period = effectivePeriod(request);
  switch (request.status) {
    case "pending":
      return `${sent} 보냄 · ${deadlineText(request.expires_at)}까지 답이 없으면 만료 (${timeLeft(request.expires_at)}) · 희망 ${shortPeriod(request.start_date, request.end_date)}`;
    case "accepted":
      return `${formatDate(request.responded_at ?? request.created_at)} 수락 · ${period.adjusted ? "조정한" : "희망"} 기간 ${shortPeriod(period.start, period.end)}`;
    case "expired":
      return request.responded_at
        ? `${formatDate(request.responded_at)} 수락 · 선택 기한 안에 협업을 시작하지 않아 만료됐어요`
        : `${sent} 보냄 · ${deadlineText(request.expires_at)} 만료 (기한 안에 답이 없었어요)`;
    case "rejected": {
      const reason = request.reject_text || (request.reject_reason ? REJECT_REASON_LABELS[request.reject_reason] : "");
      return `${formatDate(request.responded_at ?? request.created_at)} 거절${reason ? ` · “${reason}”` : ""}`;
    }
    case "canceled":
      return request.cancel_reason === "expert_withdrew"
        ? `${request.expert.nickname} 님이 수락을 취소했어요`
        : `진행 중인 협업이 ${RULES.maxActive}개가 되어 자동으로 닫혔어요`;
    default:
      return sent;
  }
}

/** [협업 시작하기] 확인 창. 확정하면 되돌릴 수 없어서 한 번 더 확인해요. */
function StartConfirm({
  request,
  research,
  activeCount,
  others,
  onClose,
  onConfirm,
}: {
  request: SentRequest;
  research: Research;
  activeCount: number; // 지금 진행 중인 협업 수 (이 협업을 시작하기 전)
  others: SentRequest[]; // 같은 연구로 아직 열려 있는 다른 요청
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const period = effectivePeriod(request);
  const meeting =
    research.meeting_type === "offline_ok" ? `대면 가능 · ${research.face_to_area ?? ""}` : research.meeting_type ? MEETING_LABELS[research.meeting_type] : "정하지 않음";
  const becomesFull = activeCount + 1 >= RULES.maxActive;
  const beforeStart = period.start > todayDate();

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
        <dd className="font-medium">
          {formatPeriod(period.start, period.end)}
          {period.adjusted && <span className="ml-1 text-xs font-normal text-brand">(전문가가 조정한 기간)</span>}
        </dd>
        <dt className="text-xs text-faint">미팅 방식</dt>
        <dd className="font-medium">{meeting}</dd>
      </dl>
      <ul className="mt-4 space-y-2 text-sm text-muted">
        <li>• 이 전문가와 둘만의 협업 공간이 만들어져요</li>
        {beforeStart && <li>• 시작일({formatDate(period.start)}) 전까지는 대기 상태예요. 그동안 일정은 미리 잡을 수 있어요</li>}
        <li>
          • 이 연구로 진행 중인 협업이 {activeCount + 1} / {RULES.maxActive}명이 돼요
        </li>
        {becomesFull && others.length > 0 && (
          <li className="text-danger">• 협업 인원이 다 차서 {others.map((other) => other.expert.nickname).join(", ")} 님 요청은 자동으로 닫혀요</li>
        )}
      </ul>
    </Modal>
  );
}

/** [이 연구로 더 안 받기] 확인 창 */
function CloseConfirm({ waiting, accepted, onClose, onConfirm }: { waiting: number; accepted: number; onClose: () => void; onConfirm: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
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
      title="이 연구로 더 안 받을까요?"
      description="열려 있는 요청을 모두 닫아요. 이미 시작한 협업은 그대로예요."
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <SmallButton onClick={onClose} disabled={busy}>
            아니요
          </SmallButton>
          <button type="button" onClick={confirm} disabled={busy} className="h-10 rounded-button bg-danger px-5 text-sm font-semibold text-white disabled:opacity-60">
            {busy ? "닫는 중…" : "모두 닫기"}
          </button>
        </div>
      }
    >
      <ul className="space-y-2 text-sm text-muted">
        {waiting > 0 && <li>• 답 기다리는 요청 {waiting}건은 취소돼요. 이 전문가들에게는 한 번 더 보낼 수 있어요</li>}
        {accepted > 0 && <li>• 수락된 요청 {accepted}건은 거절돼요. 이 전문가들에게는 다시 보낼 수 없어요</li>}
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
    const sent = requests.filter((request) => request.research_id === researchId && !closedByMe(request));
    if (sent.length === 0) return "아직 보낸 요청 없음";
    const accepted = sent.filter((request) => request.status === "accepted").length;
    const pending = sent.filter((request) => request.status === "pending").length;
    const detail = accepted ? ` · 선택 필요 ${accepted}` : pending ? ` · 답 기다리는 중 ${pending}` : "";
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
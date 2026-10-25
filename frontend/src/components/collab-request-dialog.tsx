"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { INPUT_CLASS, Modal } from "@/components/modal";
import { ApiError, requestApi } from "@/lib/api";
import { formatPeriod, type SentRequest } from "@/lib/collab-requests";
import { categoryNames, dayAfter, MESSAGE_LIMIT, monthDay, today, type ExpertPublicProfile, type Names } from "@/lib/expert-search";
import { MEETING_LABELS, REWARD_LABELS as EXPERT_REWARD_LABELS, TIME_LABELS } from "@/lib/my-career";
import { DATA_STATUS_LABELS, DATA_TYPE_LABELS, SHARE_LABELS, type Research } from "@/lib/my-research";

type Props = {
  expert: { user_id: number; nickname: string };
  role: "researcher" | "expert" | null;
  names: Names;
  onClose: () => void;
};

/** 협업 요청 창: 1단계 입력 → 2단계 확인(체크해야 보내기) → 보낸 뒤 확인 창. */
export function CollabRequestDialog({ expert, role, names, onClose }: Props) {
  const [step, setStep] = useState<1 | 2 | "done">(1);
  const [profile, setProfile] = useState<ExpertPublicProfile | null>(null);
  const [researches, setResearches] = useState<Research[] | null>(null);
  const [startedIds, setStartedIds] = useState<Set<number>>(new Set()); // 이미 협업을 시작한 연구 (새 요청 불가)
  const [loadError, setLoadError] = useState("");

  const [researchId, setResearchId] = useState<number | null>(null);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [message, setMessage] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [sentToOther, setSentToOther] = useState(false); // 지정한 연구가 아닌 연구로 보냈는지 (요청관리 안내용)

  useEffect(() => {
    if (role !== "researcher") return;
    Promise.all([
      requestApi<ExpertPublicProfile>(`/experts/${expert.user_id}`),
      requestApi<Research[]>("/researcher/researches"),
      requestApi<SentRequest[]>("/researcher/requests"),
    ])
      .then(([expertProfile, list, sent]) => {
        const registered = list.filter((item) => item.status === "registered");
        const started = new Set(sent.filter((item) => item.status === "started").map((item) => item.research_id));
        const open = registered.filter((item) => !started.has(item.research_id));
        setProfile(expertProfile);
        setResearches(registered);
        setStartedIds(started);
        // 지정한 연구를 먼저 골라 두고(협업 중인 연구는 빼고), 협업 중인 전문가는 끝난 다음 날부터 시작하도록 채워 둬요.
        setResearchId((open.find((item) => item.is_primary) ?? open[0])?.research_id ?? null);
        if (expertProfile.engaged_until) setStart(dayAfter(expertProfile.engaged_until));
      })
      .catch((caught) => setLoadError(caught instanceof ApiError ? caught.message : "잠시 후 다시 시도해 주세요"));
  }, [expert.user_id, role]);

  const title = `${expert.nickname} 님에게 협업 요청`;

  // 연구회원만 보낼 수 있어요.
  if (role !== "researcher") {
    return (
      <Modal title={title} onClose={onClose} footer={<FooterButtons onClose={onClose} />}>
        <p className="text-sm text-muted">{role === "expert" ? "협업 요청은 연구회원만 보낼 수 있어요." : "연구회원으로 로그인하면 협업을 요청할 수 있어요."}</p>
        {role === null && (
          <Link href="/login" className="mt-4 inline-flex h-10 items-center rounded-button bg-brand px-4 text-sm font-semibold text-white">
            로그인하러 가기
          </Link>
        )}
      </Modal>
    );
  }

  if (step === "done") {
    return (
      <Modal title={`${expert.nickname} 님에게 요청을 보냈어요`} onClose={onClose} footer={<FooterButtons onClose={onClose} label="확인" primary />}>
        <p className="text-sm text-muted">7일 안에 답이 없으면 요청은 만료돼요.</p>
        <p className="mt-1 text-sm text-muted">
          보낸 요청은{" "}
          <Link href="/requests" className="font-semibold text-brand">
            내 공간 › 요청관리
          </Link>
          에서 볼 수 있어요.
        </p>
        {sentToOther && <p className="mt-2 rounded-button bg-page px-3 py-2 text-xs text-muted">지정한 연구가 아닌 연구로 보냈어요. 요청관리에서 [다른 연구로 바꾸기]로 이 연구를 고르면 보여요.</p>}
      </Modal>
    );
  }

  if (loadError) {
    return (
      <Modal title={title} onClose={onClose} footer={<FooterButtons onClose={onClose} />}>
        <p className="text-sm text-danger">{loadError}</p>
      </Modal>
    );
  }
  if (!profile || !researches) {
    return (
      <Modal title={title} onClose={onClose} footer={<FooterButtons onClose={onClose} />}>
        <p className="py-6 text-center text-sm text-faint">불러오는 중…</p>
      </Modal>
    );
  }

  const research = researches.find((item) => item.research_id === researchId) ?? null;
  const periodOk = Boolean(start && end && end >= start);
  const ready = Boolean(research) && periodOk && message.trim() !== "";

  async function send() {
    if (!research) return;
    setSending(true);
    setSendError("");
    try {
      await requestApi("/researcher/requests", {
        method: "POST",
        body: JSON.stringify({ expert_id: expert.user_id, research_id: research.research_id, start_date: start, end_date: end, message: message.trim() }),
      });
      setSentToOther(!research.is_primary);
      setStep("done");
    } catch (caught) {
      setSendError(caught instanceof ApiError ? caught.message : "잠시 후 다시 시도해 주세요");
    } finally {
      setSending(false);
    }
  }

  if (step === 1) {
    return (
      <Modal
        title={title}
        description="요청할 내용을 적어 주세요. 다음 단계에서 한 번 더 확인해요."
        onClose={onClose}
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="h-10 rounded-button px-4 text-sm font-semibold text-muted">
              취소
            </button>
            <button type="button" disabled={!ready} onClick={() => setStep(2)} className="h-10 rounded-button bg-brand px-5 text-sm font-semibold text-white disabled:opacity-40">
              다음
            </button>
          </div>
        }
      >
        <Steps current={1} />
        <FieldLabel text="어떤 연구로 요청할까요?" />
        {researches.length === 0 ? (
          <div className="mt-2 rounded-card border border-dashed border-line p-5 text-center text-sm text-muted">
            등록한 연구가 있어야 요청할 수 있어요.
            <Link href="/my-research" className="ml-2 font-semibold text-brand">
              연구 등록하기
            </Link>
          </div>
        ) : (
          <ul className="mt-2 space-y-2">
            {researches.map((item) => {
              const on = item.research_id === researchId;
              const started = startedIds.has(item.research_id);
              return (
                <li key={item.research_id}>
                  <label className={`flex gap-3 rounded-card border p-3 ${started ? "cursor-not-allowed border-line bg-page opacity-60" : on ? "cursor-pointer border-brand bg-brand-soft" : "cursor-pointer border-line"}`}>
                    <input type="radio" name="request-research" checked={on} disabled={started} onChange={() => setResearchId(item.research_id)} className="mt-1 accent-brand" />
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold">
                        {item.title}
                        {started && <span className="ml-2 text-xs font-normal text-muted">협업 진행 중이라 새 요청을 보낼 수 없어요</span>}
                      </span>
                      <span className="mt-1.5 flex flex-wrap gap-1.5">
                        {[...categoryNames(item.field_ids, names), ...item.able_work_ids.map((id) => names.works.get(id) ?? id)].map((tag) => (
                          <span key={tag} className="rounded-full bg-white px-2 py-0.5 text-[11px] text-muted">
                            {tag}
                          </span>
                        ))}
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
        <Link href="/my-research" className="mt-2 inline-block text-xs font-semibold text-brand">
          + 새 연구 등록하기
        </Link>

        <FieldLabel text="희망 기간" />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <div className="min-w-[140px] flex-1">
            <input type="date" aria-label="희망 시작일" value={start} min={today()} onChange={(event) => setStart(event.target.value)} className={INPUT_CLASS} />
          </div>
          <span className="text-muted">~</span>
          <div className="min-w-[140px] flex-1">
            <input type="date" aria-label="희망 종료일" value={end} min={start || today()} onChange={(event) => setEnd(event.target.value)} className={INPUT_CLASS} />
          </div>
          {periodOk && <span className="text-xs text-muted">{formatPeriod(start, end).split(" · ")[1]}</span>}
        </div>
        {start && end && end < start && <p className="mt-1 text-xs text-danger">종료일은 시작일보다 빠를 수 없어요.</p>}
        {profile.engaged && (
          <p className="mt-2 rounded-button bg-page px-3 py-2 text-xs text-muted">
            {expert.nickname} 님은 지금 협업 중이라
            {profile.engaged_until ? ` ${monthDay(dayAfter(profile.engaged_until))}부터 시작할 수 있어요` : " 시작 시점은 메시지로 맞춰 주세요"}
          </p>
        )}

        <FieldLabel text="메시지" />
        <textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          maxLength={MESSAGE_LIMIT}
          rows={4}
          placeholder="연구 목표, 데이터 상황, 기대하는 역할을 적어 주세요."
          className={`${INPUT_CLASS} mt-2 h-auto py-2`}
        />
        <p className="text-right text-xs text-faint">
          {message.length} / {MESSAGE_LIMIT}
        </p>
      </Modal>
    );
  }

  // 2단계: 확인
  const collaboration = profile.collaboration;
  return (
    <Modal
      title={title}
      description="보내기 전에 아래 내용을 한 번 더 확인해 주세요."
      onClose={onClose}
      footer={
        <div>
          {sendError && <p className="mb-2 text-sm text-danger">{sendError}</p>}
          <div className="flex justify-between gap-2">
            <button type="button" onClick={() => setStep(1)} disabled={sending} className="h-10 rounded-button border border-line px-4 text-sm font-semibold">
              이전
            </button>
            <button type="button" onClick={send} disabled={!agreed || sending} className="h-10 rounded-button bg-brand px-5 text-sm font-semibold text-white disabled:opacity-40">
              {sending ? "보내는 중…" : "협업 요청 보내기"}
            </button>
          </div>
        </div>
      }
    >
      <Steps current={2} />
      <Summary title="내가 입력한 것">
        <Row label="연구" value={research?.title ?? ""} />
        <Row label="희망 기간" value={formatPeriod(start, end)} />
        <Row label="메시지" value={message.trim()} />
      </Summary>
      {research && (
        <Summary title="내 데이터" note="내 연구에 적은 그대로 전달돼요">
          <Row label="데이터 종류" value={research.data_types.map((type) => DATA_TYPE_LABELS[type]).join(", ") || "-"} />
          <Row label="데이터 상태" value={research.data_status ? DATA_STATUS_LABELS[research.data_status] : "-"} />
          <Row label="공유 조건" value={research.share_policy ? (research.share_condition ? `${SHARE_LABELS[research.share_policy].title} · ${research.share_condition}` : SHARE_LABELS[research.share_policy].title) : "-"} />
          {research.share_policy === "conditional" && <p className="mt-2 text-xs text-muted">{expert.nickname} 님이 이 공유 조건에 동의해야 요청을 수락할 수 있어요.</p>}
        </Summary>
      )}
      <Summary title={`${expert.nickname} 님의 협업 조건`}>
        {collaboration ? (
          <>
            <Row label="미팅" value={collaboration.face_to_area ? `${MEETING_LABELS[collaboration.meeting_type]} · ${collaboration.face_to_area}` : MEETING_LABELS[collaboration.meeting_type]} />
            <Row label="주당 시간" value={TIME_LABELS[collaboration.available_time]} />
            <Row label="희망 보상" value={collaboration.rewards.map((code) => EXPERT_REWARD_LABELS[code]).join(", ") || "-"} />
          </>
        ) : (
          <p className="text-sm text-muted">협업 조건을 아직 적지 않았어요.</p>
        )}
      </Summary>
      <label className="mt-4 flex cursor-pointer gap-3 rounded-card border border-line p-4">
        <input type="checkbox" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} className="mt-0.5 h-4 w-4 accent-brand" />
        <span>
          <span className="block text-sm font-semibold">위 내용을 모두 확인했어요</span>
          <span className="mt-0.5 block text-xs text-muted">실제 데이터는 수락한 뒤, 공유 조건에 맞춰 주고받아요</span>
        </span>
      </label>
    </Modal>
  );
}

function Steps({ current }: { current: 1 | 2 }) {
  return (
    <ol className="mb-5 flex gap-4 text-xs font-semibold">
      {["입력", "확인"].map((label, index) => (
        <li key={label} className={`flex items-center gap-1.5 ${index + 1 === current ? "text-brand" : "text-faint"}`}>
          <span className={`grid h-5 w-5 place-items-center rounded-full text-[11px] ${index + 1 === current ? "bg-brand text-white" : "bg-page"}`}>{index + 1}</span>
          {label}
        </li>
      ))}
    </ol>
  );
}

function FieldLabel({ text }: { text: string }) {
  return (
    <p className="mt-5 text-sm font-semibold first-of-type:mt-0">
      {text} <span className="ml-1 text-xs font-normal text-brand">필수</span>
    </p>
  );
}

function Summary({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="mt-4 first-of-type:mt-0">
      <h3 className="text-sm font-bold">
        {title} {note && <span className="ml-1 text-xs font-normal text-faint">{note}</span>}
      </h3>
      <dl className="mt-2 rounded-card border border-line p-4">{children}</dl>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[88px_1fr] gap-3 py-1 text-sm">
      <dt className="text-muted">{label}</dt>
      <dd className="whitespace-pre-line">{value}</dd>
    </div>
  );
}

function FooterButtons({ onClose, label = "닫기", primary = false }: { onClose: () => void; label?: string; primary?: boolean }) {
  return (
    <div className="flex justify-end">
      <button type="button" onClick={onClose} className={`h-10 rounded-button px-5 text-sm font-semibold ${primary ? "bg-brand text-white" : "border border-line"}`}>
        {label}
      </button>
    </div>
  );
}
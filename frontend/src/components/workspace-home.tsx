"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import { daysBetween, formatPeriod, photoOrDefault, todayDate } from "@/lib/collab-requests";
import { Collaboration, isOngoing, loadWorkspace, openCollaboration, Schedule, WorkspaceData } from "@/lib/workspace";
import { Avatar, StatusBadge, Tabs } from "@/components/request-parts";
import { WorkspaceCalendar } from "@/components/workspace-calendar";
import { CollabList } from "@/components/workspace-collab-list";
import { OpenCollabDialog } from "@/components/workspace-open-dialog";
import { TodoBox, TodoItem } from "@/components/workspace-todo";
import { UpcomingList } from "@/components/workspace-upcoming";

type Tab = "ongoing" | "finished";

/** 협업 공간 첫 화면: 위 내 협업 목록, 가운데 달력, 오른쪽 지금 할 일·다가오는 일정. [완료] 탭에서는 달력을 숨겨요. */
export function WorkspaceHome({ role, myNickname }: { role: "researcher" | "expert"; myNickname: string }) {
  const [data, setData] = useState<WorkspaceData | null>(null);
  const [loadError, setLoadError] = useState("");
  const [tab, setTab] = useState<Tab>("ongoing");
  const [opening, setOpening] = useState<Collaboration | null>(null); // [협업 공간 열기] 창
  const [hidden, setHidden] = useState<number[]>([]); // 달력에서 끈 협업
  const [dismissed, setDismissed] = useState<string[]>([]); // × 로 숨긴 할 일

  useEffect(() => {
    loadWorkspace()
      .then(setData)
      .catch((error) => setLoadError(error instanceof ApiError ? error.message : "잠시 후 다시 시도해 주세요"));
  }, []);

  if (loadError) return <p className="py-20 text-center text-sm text-danger">{loadError}</p>;
  if (!data) return <p className="py-20 text-center text-sm text-faint">불러오는 중…</p>;

  const today = todayDate();
  // 진행 중 탭: 시작 전 + 진행 중. 안 연 협업 먼저, 그다음 날짜가 가까운 순 (시작 전은 시작일, 진행 중은 종료일 기준)
  const ongoing = data.collaborations.filter(isOngoing).sort(
    (a, b) =>
      Number(a.opened) - Number(b.opened) || // 아직 안 연 협업이 맨 위
      (a.status === "waiting" ? a.start_date : a.end_date).localeCompare(b.status === "waiting" ? b.start_date : b.end_date),
  );
  const finished = data.collaborations.filter((collab) => !isOngoing(collab)).sort((a, b) => b.end_date.localeCompare(a.end_date));
  // 달력에는 열어 둔 협업 일정만, 끈 협업은 빼고 보여요
  const opened = ongoing.filter((collab) => collab.opened);
  const shownIds = new Set(opened.filter((collab) => !hidden.includes(collab.collaboration_id)).map((collab) => collab.collaboration_id));
  const schedules = data.schedules.filter((item) => shownIds.has(item.collaboration_id));
  const todos = buildTodos(ongoing, data.schedules, today, setOpening).filter((item) => !dismissed.includes(item.key));

  return (
    <div>
      <h1 className="text-[28px] font-bold">{role === "researcher" ? "협업 공간" : "내 협업"}</h1>
      <p className="mt-1 text-sm text-muted">협업 하나는 연구 × 전문가 1:1이에요. 일정은 각 협업의 두 사람만 볼 수 있어요. 대화는 디스코드에서 해요.</p>

      <div className="mt-6">
        <Tabs
          current={tab}
          onChange={setTab}
          tabs={[
            { key: "ongoing", label: "진행 중", count: ongoing.length },
            { key: "finished", label: "완료", count: finished.length },
          ]}
        />
      </div>

      {tab === "finished" ? (
        <FinishedList collabs={finished} role={role} />
      ) : ongoing.length === 0 ? (
        <EmptyOngoing role={role} />
      ) : (
        <>
          {/* 위: 내 협업 (가로로 긴 줄, 3개까지) */}
          <CollabList
            collabs={ongoing}
            hidden={hidden}
            today={today}
            onToggle={(id) => setHidden((list) => (list.includes(id) ? list.filter((item) => item !== id) : [...list, id]))}
            onOpen={setOpening}
          />

          {/* 가운데: 달력 / 오른쪽: 지금 할 일 + 다가오는 일정 (모바일에서는 할 일·일정이 달력보다 먼저) */}
          <div className="mt-5 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
            <WorkspaceCalendar schedules={schedules} today={today} openedCount={opened.length} />
            <div className="order-first space-y-5 lg:order-none">
              <TodoBox items={todos.map((item) => (item.dismissible ? { ...item, onDismiss: () => setDismissed((list) => [...list, item.key]) } : item))} />
              <UpcomingList collabs={ongoing} schedules={schedules} today={today} />
            </div>
          </div>
        </>
      )}

      {opening && (
        <OpenCollabDialog
          collab={opening}
          myNickname={myNickname}
          onClose={() => setOpening(null)}
          onOpen={async () => {
            // 구글 연결(withGoogle)은 다음 단계에서 붙여요. 지금은 열림만 저장해요.
            setData(await openCollaboration(opening.collaboration_id));
            setOpening(null);
          }}
        />
      )}
    </div>
  );
}

/**
 * "지금 할 일" 만들기. 협업마다 지금 상태를 보고 해야 할 일을 골라요.
 * ① 아직 안 연 협업 → 열기 (시작이 내일 이내면 빨간 점)
 * ② 열었지만 직접 잡은 일정이 없음 → 첫 미팅 잡기
 * ③ 열었지만 구글 캘린더에 안 넣음 → 권장 (× 로 숨길 수 있어요)
 */
function buildTodos(collabs: Collaboration[], schedules: Schedule[], today: string, open: (collab: Collaboration) => void) {
  const items: (TodoItem & { dismissible?: boolean })[] = [];
  for (const collab of collabs) {
    const who = <b>{collab.partner.nickname}</b>;
    const soon = collab.status === "waiting" && daysBetween(today, collab.start_date) <= 1;
    if (!collab.opened) {
      items.push({
        key: `open-${collab.collaboration_id}`,
        tone: soon ? "danger" : "brand",
        text: (
          <>
            {who} 님과의 협업이 {startText(collab, today)}. 협업 공간을 열어 주세요
          </>
        ),
        action: <TodoButton onClick={() => open(collab)}>협업 공간 열기</TodoButton>,
      });
      continue;
    }
    // 번호가 양수인 일정 = 직접 잡은 일정 (음수는 자동으로 넣은 시작일·종료일)
    if (!schedules.some((item) => item.collaboration_id === collab.collaboration_id && item.schedule_id > 0)) {
      items.push({
        key: `first-${collab.collaboration_id}`,
        tone: "brand",
        text: <>{who} 님과 첫 미팅 날짜를 잡아 보세요</>,
        action: <TodoButton onClick={() => undefined}>+ 일정 추가</TodoButton>, // TODO(다음 단계): 일정 추가 창
      });
    }
    if (!collab.google_linked) {
      items.push({
        key: `google-${collab.collaboration_id}`,
        tone: "muted",
        dismissible: true,
        text: <>{who} 님 협업 일정을 내 구글 캘린더에도 받아 보세요. 폰으로 알림이 와요</>,
        action: <TodoButton onClick={() => undefined}>구글 캘린더에 추가</TodoButton>, // TODO(구글)
      });
    }
  }
  const order = (key: string) => (key.startsWith("open") ? 0 : key.startsWith("first") ? 1 : 2);
  return items.sort((a, b) => order(a.key) - order(b.key));
}

/** "내일 시작돼요" · "6일 뒤 시작돼요" · "오늘 시작됐어요" · "진행 중이에요" */
function startText(collab: Collaboration, today: string): string {
  if (collab.status !== "waiting") return "진행 중이에요";
  const days = daysBetween(today, collab.start_date);
  return days <= 0 ? "오늘 시작됐어요" : days === 1 ? "내일 시작돼요" : `${days}일 뒤 시작돼요`;
}

function TodoButton({ onClick, children }: { onClick: () => void; children: string }) {
  return (
    <button type="button" onClick={onClick} className="h-8 rounded-button border border-line bg-card px-3 text-[13px] font-semibold text-ink hover:bg-page">
      {children}
    </button>
  );
}

/** [완료] 탭: 달력 없이 끝난 협업 목록만. 평가는 협업 상세에서 남겨요. */
function FinishedList({ collabs, role }: { collabs: Collaboration[]; role: "researcher" | "expert" }) {
  if (collabs.length === 0) {
    return <p className="mt-3 rounded-card border border-dashed border-line px-6 py-12 text-center text-sm text-muted">끝난 협업이 아직 없어요</p>;
  }
  const label = { done: "완료", ended_early: "중도 종료", canceled: "시작 전 취소", waiting: "", active: "" } as const;
  return (
    <>
      <p className="mt-4 text-[13px] text-faint">끝난 협업은 읽기 전용 기록으로 남아요. 일정은 달력에서 빠지고 각 협업 안에 남아요.</p>
      <ul className="mt-3 space-y-3">
        {collabs.map((collab) => (
          <li key={collab.collaboration_id} className="flex flex-col gap-3 rounded-card border border-line bg-card p-5 shadow-card sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <StatusBadge tone="muted">{label[collab.status]}</StatusBadge>
              <p className="mt-2 font-bold">{collab.research.title}</p>
              <p className="mt-1 flex items-center gap-2 text-[13px] text-muted">
                <Avatar src={photoOrDefault(collab.partner.user_photo, collab.partner.role)} size={20} />
                {collab.partner.nickname} 님과 1:1 · {formatPeriod(collab.start_date, collab.end_date)}
              </p>
            </div>
            <Link
              href={`/workspace/${collab.collaboration_id}`}
              className="inline-flex h-10 items-center justify-center rounded-button border border-line px-4 text-[13px] font-semibold text-muted hover:bg-page"
            >
              {role === "researcher" && collab.status !== "canceled" ? "기록 보기 · 평가" : "기록 보기"}
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

function EmptyOngoing({ role }: { role: "researcher" | "expert" }) {
  return (
    <div className="mt-5 rounded-card border border-dashed border-line px-6 py-14 text-center">
      <p className="font-semibold">진행 중인 협업이 없어요</p>
      <p className="mt-2 text-sm text-muted">
        {role === "researcher" ? "요청을 수락한 전문가와 [협업 시작하기]를 누르면 여기에 생겨요." : "연구자가 내 수락을 보고 협업을 시작하면 여기에 생겨요."}
      </p>
      <Link
        href={role === "researcher" ? "/experts" : "/requests"}
        className="mt-5 inline-flex h-10 items-center rounded-button bg-brand px-5 text-sm font-semibold text-white"
      >
        {role === "researcher" ? "AI 전문가 찾기" : "요청관리로 가기"}
      </Link>
    </div>
  );
}
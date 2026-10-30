"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import { Collaboration, Schedule } from "@/lib/workspace";
import { CollaborationDetail, loadDetail } from "@/lib/workspace-detail";
import { MySpaceShell } from "@/components/my-space-shell";
import { DetailHead } from "@/components/workspace-detail-head";
import { AgendaCard, PartnerCard } from "@/components/workspace-detail-side";
import { TasksCard } from "@/components/workspace-detail-work";
import { ScheduleDialog } from "@/components/workspace-schedule-dialog";
import { ScheduleView } from "@/components/workspace-schedule-view";

type Editor = { mode: "add" } | { mode: "view"; schedule: Schedule } | { mode: "edit"; schedule: Schedule };

/**
 * 협업 상세 (/workspace/[id])
 * 위: 머리(상태·제목·두 사람·디스코드·구글) + 협업 기간 타임라인
 * 왼쪽(넓게): 요청  /  오른쪽(따라 내려옴): 다가오는 일정 → (시작 전 준비) → 상대 + 합의 내용
 */
export function WorkspaceDetailPage({ collaborationId }: { collaborationId: number }) {
  const [detail, setDetail] = useState<CollaborationDetail | null>(null);
  const [error, setError] = useState<{ text: string; status?: number } | null>(null);
  const [editor, setEditor] = useState<Editor | null>(null); // 일정 추가·보기·수정 창

  const reload = useCallback(() => {
    loadDetail(collaborationId)
      .then(setDetail)
      .catch((caught) =>
        setError(caught instanceof ApiError ? { text: caught.message, status: caught.status } : { text: "잠시 후 다시 시도해 주세요" }),
      );
  }, [collaborationId]);

  useEffect(reload, [reload]);

  if (error) return <Notice error={error} />;
  if (!detail) return <p className="py-20 text-center text-sm text-faint">불러오는 중…</p>;

  const { collaboration: collab } = detail;
  const editable = collab.status === "waiting" || collab.status === "active"; // 끝난 협업은 보기만
  const asListCollab = toListCollab(detail); // 일정 창(목록 화면과 같은 것)이 받는 모양

  function saved() {
    setEditor(null);
    reload(); // 일정 창은 목록 데이터를 돌려주니까, 상세는 다시 불러와요
  }

  return (
    <MySpaceShell role={collab.my_side}>
      <Link href="/workspace" className="text-[13px] text-muted hover:text-ink">
        ‹ 협업 공간
      </Link>

      <div className="mt-3 grid gap-5">
        <DetailHead detail={detail} />

        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          {/* 오른쪽 칸: 넓은 화면에서는 스크롤해도 따라 내려오고, 좁은 화면에서는 맨 위로 */}
          <aside className="flex min-w-0 flex-col gap-5 lg:sticky lg:top-6 lg:order-2">
            <AgendaCard detail={detail} editable={editable} onAdd={() => setEditor({ mode: "add" })} onPick={(schedule) => setEditor({ mode: "view", schedule })} />
            <PartnerCard detail={detail} />
          </aside>

          <div className="flex min-w-0 flex-col gap-5 lg:order-1">
            <TasksCard detail={detail} editable={editable} onChange={setDetail} />
            {/* 정한 것(DecisionsCard)은 디스코드 명령어를 붙일 때 다시 넣어요 */}
          </div>
        </div>
      </div>

      {editor?.mode === "add" && (
        <ScheduleDialog collabs={[asListCollab]} defaultCollabId={collab.collaboration_id} today={collab.today} onClose={() => setEditor(null)} onSaved={saved} />
      )}
      {editor?.mode === "edit" && (
        <ScheduleDialog collabs={[asListCollab]} editing={editor.schedule} today={collab.today} onClose={() => setEditor(null)} onSaved={saved} />
      )}
      {editor?.mode === "view" && (
        <ScheduleView
          schedule={editor.schedule}
          collab={asListCollab}
          editable={editable}
          onClose={() => setEditor(null)}
          onEdit={() => setEditor({ mode: "edit", schedule: editor.schedule })}
          onDeleted={saved}
        />
      )}
    </MySpaceShell>
  );
}

/** 상세 데이터 → 목록 화면의 Collaboration 모양 (일정 추가·보기 창을 그대로 다시 쓰려고) */
function toListCollab({ collaboration: collab }: CollaborationDetail): Collaboration {
  return {
    collaboration_id: collab.collaboration_id,
    research: collab.research,
    partner: { nickname: collab.partner.nickname, user_photo: collab.partner.user_photo, role: collab.partner.role },
    start_date: collab.start_date,
    end_date: collab.end_date,
    confirmed_on: collab.confirmed_on,
    status: collab.status,
    opened: true,
    google_linked: collab.google_linked,
    discord_channel_url: collab.discord_channel_url,
  };
}

function Notice({ error }: { error: { text: string; status?: number } }) {
  const login = error.status === 401;
  return (
    <div className="py-20 text-center">
      <p className="text-sm text-muted">{error.status === 404 ? "협업을 찾을 수 없어요. 내가 함께하는 협업만 볼 수 있어요." : error.text}</p>
      <Link
        href={login ? "/login" : "/workspace"}
        className="mt-4 inline-flex h-10 items-center rounded-button bg-brand px-4 text-sm font-semibold text-white"
      >
        {login ? "로그인하러 가기" : "협업 공간으로"}
      </Link>
    </div>
  );
}
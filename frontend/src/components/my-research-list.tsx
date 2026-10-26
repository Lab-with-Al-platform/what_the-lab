"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ApiError, requestApi } from "@/lib/api";
import { formatDate, Research, ResearchInput } from "@/lib/my-research";
import { AbleWorkOption, FieldCategory, MyResearchModal } from "@/components/my-research-modal";

// 지금 열린 창: new = 새 연구 작성, 숫자 = 그 연구 수정
type OpenModal = "new" | number | null;

/** 내 연구 목록. 처음 열 때 내 연구·할 수 있는 일·연구 분야 목록을 한 번에 불러옵니다. */
export function MyResearchList() {
  const [researches, setResearches] = useState<Research[] | null>(null);
  const [ableWorks, setAbleWorks] = useState<AbleWorkOption[]>([]);
  const [fields, setFields] = useState<FieldCategory[]>([]);
  const [loadError, setLoadError] = useState("");
  const [open, setOpen] = useState<OpenModal>(null);
  const [changedNotice, setChangedNotice] = useState(false); // 방금 지정한 연구를 바꿨는지
  const [pickError, setPickError] = useState("");

  useEffect(() => {
    Promise.all([
      requestApi<Research[]>("/researcher/researches"),
      requestApi<AbleWorkOption[]>("/expert/able-works"),
      requestApi<FieldCategory[]>("/taxonomy/fields"),
    ])
      .then(([loadedResearches, loadedWorks, loadedFields]) => {
        setResearches(loadedResearches);
        setAbleWorks(loadedWorks);
        setFields(loadedFields);
      })
      .catch((error) => setLoadError(error instanceof ApiError ? error.message : "잠시 후 다시 시도해 주세요"));
  }, []);

  if (loadError) return <LoadError message={loadError} />;
  if (!researches) return <p className="py-20 text-center text-sm text-faint">불러오는 중…</p>;

  const workName = new Map(ableWorks.map((work) => [work.able_work_id, work.name]));
  const fieldName = new Map(fields.flatMap((category) => category.fields.map((field) => [field.field_id, field.name])));
  const registeredCount = researches.filter((item) => item.status === "registered").length;
  const editing = typeof open === "number" ? (researches.find((item) => item.research_id === open) ?? null) : null;

  /** 저장·삭제 요청. 백엔드가 돌려준 최신 목록으로 다시 그리고 창을 닫아요. */
  async function send(path: string, method: "POST" | "PUT" | "DELETE", body?: ResearchInput) {
    const updated = await requestApi<Research[]>(path, { method, body: body === undefined ? undefined : JSON.stringify(body) });
    setResearches(updated);
    setChangedNotice(false);
    setOpen(null);
  }

  /** 왼쪽 동그라미: 이 연구를 '지정한 연구'로 바꿔요. */
  async function pick(researchId: number) {
    setPickError("");
    try {
      setResearches(await requestApi<Research[]>(`/researcher/researches/${researchId}/primary`, { method: "PUT" }));
      setChangedNotice(true);
    } catch (error) {
      setPickError(error instanceof ApiError ? error.message : "잠시 후 다시 시도해 주세요");
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold">내 연구</h1>
          <p className="mt-1 text-sm text-muted">작성한 연구 중 하나를 지정하면, AI 전문가 찾기와 협업 요청에 그 연구가 기본으로 쓰여요.</p>
        </div>
        {researches.length > 0 && (
          <button type="button" onClick={() => setOpen("new")} className="h-11 rounded-button bg-brand px-5 text-sm font-semibold text-white hover:bg-brand-hover">
            + 연구 작성
          </button>
        )}
      </div>

      {researches.length === 0 ? (
        <EmptyState onWrite={() => setOpen("new")} />
      ) : (
        <>
          <Hint changed={changedNotice} single={registeredCount === 1} />
          {pickError && <p className="mt-2 text-[13px] text-danger">{pickError}</p>}
          <ul className="mt-4 space-y-3">
            {researches.map((research) => (
              <ResearchCard
                key={research.research_id}
                research={research}
                showRadio={registeredCount > 1}
                fieldName={fieldName}
                workName={workName}
                onPick={() => pick(research.research_id)}
                onEdit={() => setOpen(research.research_id)}
              />
            ))}
          </ul>
        </>
      )}

      {open !== null && (
        <MyResearchModal
          research={editing}
          ableWorks={ableWorks}
          fields={fields}
          onClose={() => setOpen(null)}
          onSave={(input) => (editing ? send(`/researcher/researches/${editing.research_id}`, "PUT", input) : send("/researcher/researches", "POST", input))}
          onDelete={() => send(`/researcher/researches/${editing?.research_id}`, "DELETE")}
        />
      )}
    </div>
  );
}

/** 목록 위 안내 한 줄. 상황에 따라 문구가 바뀌어요. */
function Hint({ changed, single }: { changed: boolean; single: boolean }) {
  if (changed) {
    return <p className="mt-6 rounded-button bg-success-soft px-4 py-3 text-sm font-semibold text-success">지정한 연구를 바꿨어요. 이제 AI 전문가 찾기와 협업 요청에 이 연구가 쓰여요.</p>;
  }
  if (single) {
    return <p className="mt-6 rounded-button bg-page px-4 py-3 text-sm text-muted">연구가 1개라서 자동으로 지정됐어요.</p>;
  }
  return <p className="mt-6 rounded-button bg-page px-4 py-3 text-sm text-muted">왼쪽 동그라미를 눌러 지금 찾는 연구를 지정해요. 한 번에 1개만 지정할 수 있어요.</p>;
}

type CardProps = {
  research: Research;
  showRadio: boolean;
  fieldName: Map<string, string>;
  workName: Map<string, string>;
  onPick: () => void;
  onEdit: () => void;
};

function ResearchCard({ research, showRadio, fieldName, workName, onPick, onEdit }: CardProps) {
  const draft = research.status === "draft";
  const primary = research.is_primary;
  const tasks = research.task_unsure ? ["잘 모르겠어요"] : research.able_work_ids.map((id) => workName.get(id) ?? id);
  const edited = research.updated_at.slice(0, 10) !== research.created_at.slice(0, 10);

  return (
    <li className={`flex gap-4 rounded-card border bg-card p-5 shadow-card ${primary ? "border-2 border-brand" : "border-line"}`}>
      {showRadio && (
        <div className="pt-0.5">
          {draft ? (
            <span className="block h-6 w-6" aria-hidden="true" />
          ) : (
            <button
              type="button"
              role="radio"
              aria-checked={primary}
              aria-label={`${research.title} 지정하기`}
              onClick={onPick}
              disabled={primary}
              className={`grid h-6 w-6 place-items-center rounded-full border-2 ${primary ? "border-brand" : "border-line hover:border-brand"}`}
            >
              {primary && <span className="h-3 w-3 rounded-full bg-brand" />}
            </button>
          )}
        </div>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          {primary && <span className="rounded-full bg-brand px-2.5 py-0.5 text-[11px] font-bold text-white">지정한 연구</span>}
          {draft && <span className="rounded-full border border-line bg-page px-2.5 py-0.5 text-[11px] font-bold text-muted">임시 저장</span>}
          {research.field_ids.map((id) => (
            <span key={id} className="rounded-full bg-researcher-soft px-2.5 py-0.5 text-[11px] font-semibold text-researcher">
              {fieldName.get(id) ?? id}
            </span>
          ))}
        </div>
        <h2 className="mt-2 text-base font-bold leading-snug">
          {/* 제목을 누르면 상세 화면으로 가요 */}
          <Link href={`/my-research/${research.research_id}`} className="hover:text-brand hover:underline">
            {research.title}
          </Link>
        </h2>

        {tasks.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-xs text-faint">맡길 일</span>
            {tasks.map((task) => (
              <span key={task} className="rounded-full bg-brand-soft px-2.5 py-1 text-xs text-brand">
                {task}
              </span>
            ))}
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <p className="mr-auto text-xs text-faint">
            {formatDate(research.created_at)} 작성{edited && ` · ${formatDate(research.updated_at)} 수정`}
          </p>
          {primary && (
            <Link href="/experts" className="inline-flex h-9 items-center rounded-button bg-brand px-4 text-[13px] font-semibold text-white hover:bg-brand-hover">
              이 연구로 전문가 찾기
            </Link>
          )}
          {research.open_request_count > 0 ? (
            // 진행 중인 요청이 있으면 수정이 잠겨요. 상세에서 요청을 정리한 뒤 수정할 수 있어요.
            <Link href={`/my-research/${research.research_id}`} className="inline-flex h-9 items-center rounded-button border border-line px-4 text-[13px] font-semibold text-faint hover:bg-page">
              🔒 요청 {research.open_request_count}건 진행 중
            </Link>
          ) : (
            <button type="button" onClick={onEdit} className="h-9 rounded-button border border-line px-4 text-[13px] font-semibold text-muted hover:bg-page hover:text-ink">
              {draft ? "이어서 작성" : "수정"}
            </button>
          )}
        </div>
      </div>
    </li>
  );
}

function EmptyState({ onWrite }: { onWrite: () => void }) {
  return (
    <div className="mt-8 rounded-card border border-dashed border-line bg-card px-6 py-16 text-center">
      <p className="text-lg font-bold">아직 작성한 연구가 없어요</p>
      <p className="mt-2 text-sm text-muted">연구를 작성하면 맡길 일에 맞는 AI 전문가를 추천해 드려요.</p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <button type="button" onClick={onWrite} className="h-11 rounded-button bg-brand px-5 text-sm font-semibold text-white hover:bg-brand-hover">
          + 연구 작성
        </button>
        <Link href="/experts" className="inline-flex h-11 items-center rounded-button border border-line px-5 text-sm font-semibold text-muted hover:bg-page">
          먼저 AI 전문가 둘러보기
        </Link>
      </div>
    </div>
  );
}

function LoadError({ message }: { message: string }) {
  const needsLogin = message === "로그인이 필요합니다";
  return (
    <div className="py-20 text-center">
      <p className="text-sm text-danger">{message}</p>
      {needsLogin && (
        <Link href="/login" className="mt-4 inline-flex h-10 items-center rounded-button bg-brand px-4 text-sm font-semibold text-white">
          로그인하러 가기
        </Link>
      )}
    </div>
  );
}
"use client";

import { ChangeEvent, KeyboardEvent, useRef, useState } from "react";
import { Chip, FieldTitle, INPUT_CLASS, Modal, ModalActions, toggle, useSaving } from "@/components/modal";
import { AbleWorkOption, formatBytes, LIMITS, Portfolio, portfolioPdfUrl } from "@/lib/my-career";

export type PortfolioValues = { title: string; able_work_ids: string[]; skills: string[]; role: string };

/** PDF를 어떻게 할지: 그대로 / 새 파일 올리기 / 지우기 */
export type PdfChange = { kind: "keep" } | { kind: "upload"; file: File } | { kind: "remove" };

type Props = {
  portfolio: Portfolio | null; // null = 새로 추가
  ableWorks: AbleWorkOption[];
  onClose: () => void;
  onSave: (values: PortfolioValues, pdf: PdfChange) => Promise<void>;
  onDelete: () => Promise<void>;
};

const MAX_PDF_BYTES = LIMITS.pdfMb * 1024 * 1024;

export function MyCareerPortfolioModal({ portfolio, ableWorks, onClose, onSave, onDelete }: Props) {
  const [title, setTitle] = useState(portfolio?.title ?? "");
  const [ableWorkIds, setAbleWorkIds] = useState(portfolio?.able_work_ids ?? []);
  const [skills, setSkills] = useState(portfolio?.skills ?? []);
  const [skillInput, setSkillInput] = useState("");
  const [role, setRole] = useState(portfolio?.role ?? "");
  const [pdf, setPdf] = useState<PdfChange>({ kind: "keep" });
  const [pdfError, setPdfError] = useState("");
  const [showAllWorks, setShowAllWorks] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const { saving, error, run } = useSaving();

  const visibleWorks = showAllWorks ? ableWorks : ableWorks.filter((work) => work.show_default || ableWorkIds.includes(work.able_work_id));
  const canSave = title.trim().length > 0 && role.trim().length > 0 && ableWorkIds.length > 0;
  const hasSavedPdf = Boolean(portfolio?.has_pdf) && pdf.kind === "keep";

  function addSkill(event: KeyboardEvent<HTMLInputElement>) {
    // 한글 입력 중(조합 중) Enter는 글자 확정용이라 무시합니다.
    if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
    event.preventDefault();
    const skill = skillInput.trim();
    if (skill && !skills.includes(skill) && skills.length < LIMITS.skills) {
      setSkills([...skills, skill]);
    }
    setSkillInput("");
  }

  function pickFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ""; // 같은 파일을 다시 골라도 onChange가 오도록 비워 둡니다.
    if (!file) return;
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      setPdfError("PDF 파일만 올릴 수 있어요");
    } else if (file.size > MAX_PDF_BYTES) {
      setPdfError(`PDF는 ${LIMITS.pdfMb}MB까지 올릴 수 있어요`);
    } else {
      setPdfError("");
      setPdf({ kind: "upload", file });
    }
  }

  const values = { title: title.trim(), able_work_ids: ableWorkIds, skills, role: role.trim() };

  return (
    <Modal
      title={portfolio ? "포트폴리오 수정" : "포트폴리오 추가"}
      description="무엇을 만들었고, 그때 AI로 어떤 일을 했는지만 알려 주세요"
      onClose={onClose}
      footer={
        <ModalActions
          onCancel={onClose}
          onSave={() => run(() => onSave(values, pdf))}
          onDelete={portfolio ? () => run(onDelete) : undefined}
          canSave={canSave}
          saving={saving}
          error={error}
          saveLabel={portfolio ? "저장하기" : "추가하기"}
        />
      }
    >
      <FieldTitle htmlFor="portfolio-title" required extra={`${title.length} / ${LIMITS.title}`}>
        무엇을 만들었나요
      </FieldTitle>
      <input id="portfolio-title" value={title} maxLength={LIMITS.title} onChange={(event) => setTitle(event.target.value)} placeholder="예) 흉부 CT 폐결절 자동 분할 모델" className={INPUT_CLASS} />

      <div className="mt-8">
        <FieldTitle required extra={`${ableWorkIds.length} / ${LIMITS.ableWorks}개`}>
          이 작업에서 AI로 한 일
        </FieldTitle>
        <div className="flex flex-wrap gap-2">
          {visibleWorks.map((work) => (
            <Chip
              key={work.able_work_id}
              selected={ableWorkIds.includes(work.able_work_id)}
              disabled={ableWorkIds.length >= LIMITS.ableWorks}
              onClick={() => setAbleWorkIds(toggle(ableWorkIds, work.able_work_id))}
            >
              {work.name}
            </Chip>
          ))}
        </div>
        {!showAllWorks && visibleWorks.length < ableWorks.length && (
          <button type="button" onClick={() => setShowAllWorks(true)} className="mt-3 text-sm font-semibold text-brand">
            + 더 보기
          </button>
        )}
      </div>

      <div className="mt-8">
        <FieldTitle htmlFor="portfolio-skill" optional extra={`${skills.length} / ${LIMITS.skills}개`}>
          사용 기술
        </FieldTitle>
        <div className="flex min-h-11 flex-wrap items-center gap-2 rounded-button border border-line px-3 py-2 focus-within:border-brand">
          {skills.map((skill) => (
            <span key={skill} className="inline-flex h-7 items-center gap-1 rounded-full bg-page pl-3 pr-1 text-sm">
              {skill}
              <button type="button" onClick={() => setSkills(skills.filter((item) => item !== skill))} className="grid h-5 w-5 place-items-center rounded-full text-faint hover:text-ink">
                <span className="sr-only">{skill} 빼기</span>
                <span aria-hidden="true">×</span>
              </button>
            </span>
          ))}
          {skills.length < LIMITS.skills && (
            <input
              id="portfolio-skill"
              value={skillInput}
              maxLength={LIMITS.skill}
              onChange={(event) => setSkillInput(event.target.value)}
              onKeyDown={addSkill}
              placeholder={skills.length ? "기술 추가" : "기술을 적고 Enter"}
              className="h-7 min-w-24 flex-1 text-sm outline-none placeholder:text-faint"
            />
          )}
        </div>
        <p className="mt-1 text-xs text-faint">예) 딥러닝, PyTorch, YOLO처럼 이 작업에 쓴 기술을 적어 주세요</p>
      </div>

      <div className="mt-8">
        <FieldTitle htmlFor="portfolio-role" required extra={`${role.length} / ${LIMITS.role}`}>
          내 역할
        </FieldTitle>
        <textarea
          id="portfolio-role"
          value={role}
          maxLength={LIMITS.role}
          rows={3}
          onChange={(event) => setRole(event.target.value)}
          placeholder="예) 4명 중 모델 설계와 학습을 맡았고, 결과를 판독 화면에 붙이는 API도 만들었어요."
          className="w-full resize-none rounded-button border border-line px-4 py-3 text-sm outline-none placeholder:text-faint focus:border-brand"
        />
      </div>

      <div className="mt-8">
        <FieldTitle optional>포트폴리오 PDF</FieldTitle>
        <input ref={fileInput} type="file" accept="application/pdf,.pdf" onChange={pickFile} className="sr-only" aria-label="포트폴리오 PDF 고르기" />

        {pdf.kind === "upload" ? (
          <PdfRow name={pdf.file.name} detail={`${formatBytes(pdf.file.size)} · 저장하면 올라가요`}>
            <button type="button" onClick={() => setPdf({ kind: "keep" })} className="text-sm font-semibold text-muted hover:text-ink">
              취소
            </button>
          </PdfRow>
        ) : hasSavedPdf && portfolio ? (
          <PdfRow name="올린 PDF" detail={portfolio.pdf_size ? formatBytes(portfolio.pdf_size) : ""}>
            <a href={portfolioPdfUrl(portfolio.portfolio_id)} target="_blank" rel="noreferrer" className="text-sm font-semibold text-brand">
              보기
            </a>
            <button type="button" onClick={() => fileInput.current?.click()} className="text-sm font-semibold text-muted hover:text-ink">
              바꾸기
            </button>
            <button type="button" onClick={() => setPdf({ kind: "remove" })} className="text-sm font-semibold text-danger">
              지우기
            </button>
          </PdfRow>
        ) : (
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            className="flex h-16 w-full items-center justify-center gap-2 rounded-button border border-dashed border-line text-sm font-semibold text-muted hover:border-brand hover:text-brand"
          >
            <span aria-hidden="true">＋</span> PDF 고르기
          </button>
        )}
        {pdf.kind === "remove" && (
          <p className="mt-2 text-xs text-danger">
            저장하면 올린 PDF가 지워져요.{" "}
            <button type="button" onClick={() => setPdf({ kind: "keep" })} className="font-semibold underline">
              되돌리기
            </button>
          </p>
        )}
        {pdfError && <p className="mt-2 text-xs text-danger">{pdfError}</p>}
        <p className="mt-2 text-xs text-faint">PDF만, 최대 {LIMITS.pdfMb}MB · 연락처는 지우고 올려 주세요 · 공개가 어려운 프로젝트는 비워 두세요</p>
      </div>
    </Modal>
  );
}

function PdfRow({ name, detail, children }: { name: string; detail: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-button border border-line px-4 py-3">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-button bg-danger-soft text-xs font-bold text-danger">PDF</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{name}</p>
        {detail && <p className="text-xs text-faint">{detail}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-3">{children}</div>
    </div>
  );
}
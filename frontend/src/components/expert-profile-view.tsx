"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { CollabRequestDialog } from "@/components/collab-request-dialog";
import { PageContainer } from "@/components/page-container";
import { Avatar } from "@/components/request-parts";
import { ApiError, requestApi } from "@/lib/api";
import { photoOrDefault } from "@/lib/collab-requests";
import { buildNames, countByCategory, dayAfter, monthDay, periodLabel, type ExpertCollaboration, type ExpertPublicProfile, type Names } from "@/lib/expert-search";
import { CAREER_LABELS, formatMonth, MEETING_LABELS, REWARD_LABELS, TIME_LABELS, type AbleWorkOption, type FieldCategory } from "@/lib/my-career";

type Role = "researcher" | "expert" | null; // null = 로그인 안 했거나 유형 미선택
type Tab = "work" | "history";

const DONUT_COLORS = ["#4f7bea", "#22a699", "#f5a524", "#c2508a", "#8c94ab"]; // 도넛·범례 색 (분야 순서대로)
const PARTNER_COLORS = ["#e08a2e", "#c2508a", "#4f7bea", "#22a699"]; // 함께한 연구회원 첫 글자 동그라미 색

/** AI 전문가 상세. 탭은 [연구 · 평가 · 포트폴리오] / [경력 · 학력 · 자격증] 두 개예요. */
export function ExpertProfileView({ expertId }: { expertId: string }) {
  const [profile, setProfile] = useState<ExpertPublicProfile | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState("");
  const [ableWorks, setAbleWorks] = useState<AbleWorkOption[]>([]);
  const [categories, setCategories] = useState<FieldCategory[]>([]);
  const [role, setRole] = useState<Role>(null);
  const [tab, setTab] = useState<Tab>("work");
  const [requesting, setRequesting] = useState(false); // 협업 요청 창
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!/^\d+$/.test(expertId)) {
      setNotFound(true);
      return;
    }
    requestApi<ExpertPublicProfile>(`/experts/${expertId}`)
      .then(setProfile)
      .catch((caught) => {
        if (caught instanceof ApiError && caught.status === 404) setNotFound(true);
        else setError(caught instanceof ApiError ? caught.message : "잠시 후 다시 시도해 주세요");
      });
    Promise.all([requestApi<AbleWorkOption[]>("/expert/able-works"), requestApi<FieldCategory[]>("/taxonomy/fields")])
      .then(([workList, categoryList]) => {
        setAbleWorks(workList);
        setCategories(categoryList);
      })
      .catch(() => undefined); // 이름표를 못 불러오면 칩만 비어 보여요
    requestApi<{ user_role: Role }>("/auth/me")
      .then((me) => setRole(me.user_role))
      .catch(() => setRole(null)); // 로그인 안 해도 프로필은 볼 수 있어요
  }, [expertId]);

  const names = useMemo<Names>(() => buildNames(ableWorks, categories), [ableWorks, categories]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  if (notFound || error || !profile) {
    return (
      <PageContainer className="pt-6 pb-20">
        <div className="mx-auto max-w-[1120px]">
          <BackLink />
          {notFound || error ? (
            <div className="mt-6 rounded-2xl border border-[#e6e3f6] bg-card p-10 text-center">
              <p className="text-base font-bold">{notFound ? "공개된 전문가를 찾을 수 없어요" : "프로필을 불러오지 못했어요"}</p>
              <p className="mt-2 text-sm text-muted">{notFound ? "비공개로 바뀌었거나 없는 주소예요." : error}</p>
            </div>
          ) : (
            <p className="mt-6 text-sm text-muted">불러오는 중…</p>
          )}
        </div>
      </PageContainer>
    );
  }

  const collaborations = profile.collaborations ?? []; // 백엔드가 옛 버전이어도 화면은 열려요
  const finished = collaborations.filter((item) => !item.ongoing); // 마친 연구 (도넛에 씀)
  const hasHistory = profile.careers.length + profile.educations.length + profile.certificates.length > 0;
  const isNew = collaborations.length === 0;
  const meta = [profile.affiliation, `AI 경력 ${CAREER_LABELS[profile.ai_career] ?? profile.ai_career}`].filter(Boolean).join(" · ");
  const startLabel = profile.engaged ? (profile.engaged_until ? `${monthDay(dayAfter(profile.engaged_until))}부터` : "협업 종료 후") : "바로";
  const rewards = profile.collaboration ? profile.collaboration.rewards.map((code) => REWARD_LABELS[code]).join(", ") : "";
  const currentTab: Tab = hasHistory ? tab : "work"; // 경력·학력·자격증을 하나도 안 적었으면 그 탭은 숨겨요

  return (
    <PageContainer className="pt-6 pb-32 lg:pb-20">
      <div className="mx-auto max-w-[1120px]">
        <BackLink />
        <div className="mt-4 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          <article className="lg:rounded-2xl lg:border lg:border-[#e6e3f6] lg:bg-card lg:p-8">
            {/* 머리 */}
            <header className="flex gap-4 lg:gap-[18px]">
              <span className="hidden lg:block">
                <Avatar src={photoOrDefault(profile.user_photo, "expert")} size={80} />
              </span>
              <span className="lg:hidden">
                <Avatar src={photoOrDefault(profile.user_photo, "expert")} size={64} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
                  <h1 className="text-[22px] leading-9 font-medium text-ink lg:text-[26px]">{profile.nickname}</h1>
                  {profile.engaged && <EngagedBadge until={profile.engaged_until} />}
                  {isNew && (
                    <span className="inline-flex h-6 items-center gap-[5px] rounded-[7px] bg-[#eeedfb] pr-[9px] pl-2 text-xs text-[#3d33b8]">
                      <i className="size-1.5 rounded-full bg-[#4b3fd6]" />
                      신규 전문가
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={copyLink}
                    className="ml-auto hidden h-[30px] items-center gap-1.5 rounded-lg border border-[#e1e2ea] bg-white px-2.5 text-xs text-[#5e6678] hover:bg-page lg:inline-flex"
                  >
                    <LinkIcon />
                    {copied ? "복사했어요" : "링크 복사"}
                  </button>
                </div>
                <p className="mt-0.5 hidden text-[13px] leading-5 text-[#6b7285] lg:block">{meta}</p>
              </div>
            </header>
            <div className="lg:pl-[98px]">
              <p className="mt-3 text-[15px] leading-[23px] text-[#2a3350]">{profile.introduce}</p>
              <p className="mt-2 text-[13px] leading-5 text-[#8c94ab] lg:hidden">{meta}</p>
              <dl className="mt-4 grid gap-2.5">
                <ChipRow label="도메인" items={profile.domain_ids.map((id) => names.fields.get(id) ?? "")} tone="teal" />
                <ChipRow label="할 수 있는 일" items={profile.able_work_ids.map((id) => names.works.get(id) ?? "")} tone="brand" />
              </dl>
            </div>

            {/* 모바일: 오른쪽 카드 내용이 머리 아래로 와요 */}
            <div className="mt-5 grid gap-4 lg:hidden">
              <FieldSummary finished={finished} names={names} />
              <Conditions profile={profile} />
            </div>

            {/* 탭 */}
            <div role="tablist" className="mt-7 flex gap-5 border-b border-[#e6e7ee] lg:gap-7 lg:px-1">
              <TabButton active={currentTab === "work"} onClick={() => setTab("work")}>
                연구 · 평가 · 포트폴리오
              </TabButton>
              {hasHistory && (
                <TabButton active={currentTab === "history"} onClick={() => setTab("history")}>
                  경력 · 학력 · 자격증
                </TabButton>
              )}
            </div>

            <div className="pt-6">{currentTab === "work" ? <WorkTab profile={profile} collaborations={collaborations} names={names} /> : <HistoryTab profile={profile} />}</div>
          </article>

          {/* 오른쪽 협업 카드 (데스크톱) */}
          <aside className="hidden rounded-2xl border border-[#e6e3f6] bg-card p-[25px] shadow-[0_14px_36px_rgba(75,63,214,0.08)] lg:sticky lg:top-24 lg:block">
            <h2 className="text-[17px] leading-[25px] text-ink">{profile.nickname} 님과 협업하기</h2>
            <div className="mt-4">
              <FieldSummary finished={finished} names={names} />
            </div>
            <dl className="mt-[18px] grid grid-cols-[80px_1fr] gap-y-2.5 text-[13px] leading-[19px]">
              <dt className="text-[#8c94ab]">참여 상태</dt>
              {profile.engaged ? (
                <dd className="text-[#b26a00]">참여 중{profile.engaged_until ? ` · ${monthDay(profile.engaged_until)} 종료 예정` : ""}</dd>
              ) : (
                <dd className="text-success">참여 중인 협업 없음</dd>
              )}
              {profile.engaged && (
                <>
                  <dt className="text-[#8c94ab]">시작 가능</dt>
                  <dd className="text-ink">{startLabel}</dd>
                </>
              )}
            </dl>
            <div className="mt-4">
              <Conditions profile={profile} />
            </div>
            <button
              type="button"
              onClick={() => setRequesting(true)}
              className="mt-5 flex h-[50px] w-full items-center justify-center gap-2 rounded-xl bg-[#4b3fd6] text-[15px] text-white hover:bg-[#3d33b8]"
            >
              <SendIcon />
              협업 요청
            </button>
            <p className="mt-2.5 text-center text-xs leading-[18px] text-[#8c94ab]">
              요청하면 {profile.nickname} 님에게
              <br />
              디스코드 DM으로 알려 드려요
            </p>
          </aside>
        </div>
      </div>

      {/* 모바일: 아래 고정 줄 */}
      <div className="fixed inset-x-0 bottom-0 z-20 flex items-center gap-3 border-t border-[#ecebf4] bg-white px-4 py-4 lg:hidden">
        <div className="min-w-0 flex-1">
          <p className={`text-[13px] leading-[19px] ${profile.engaged ? "text-[#b26a00]" : "text-success"}`}>{startLabel === "바로" ? "바로 시작 가능" : `${startLabel} 시작 가능`}</p>
          {rewards && <p className="truncate text-xs leading-[18px] text-[#8c94ab]">{rewards}</p>}
        </div>
        <button type="button" onClick={() => setRequesting(true)} className="h-12 w-[150px] shrink-0 rounded-xl bg-[#4b3fd6] text-[15px] text-white">
          협업 요청
        </button>
      </div>

      {requesting && <CollabRequestDialog expert={{ user_id: profile.user_id, nickname: profile.nickname }} role={role} names={names} onClose={() => setRequesting(false)} />}
    </PageContainer>
  );
}

/* ---------- 탭 내용 ---------- */

function WorkTab({ profile, collaborations, names }: { profile: ExpertPublicProfile; collaborations: ExpertCollaboration[]; names: Names }) {
  return (
    <>
      {collaborations.length === 0 ? (
        <div className="flex items-start gap-2.5 rounded-xl bg-[#f6f6fa] px-[18px] py-4 text-[13px] leading-[19px] text-[#6b7285]">
          <InfoIcon />
          아직 이 서비스에서 마친 협업이 없어요. 아래 포트폴리오에서 경험을 확인해 보세요.
        </div>
      ) : (
        <>
          {/* 평가 요약: 평가 기능이 생기면 평균 평점·항목별 막대가 이 자리에 들어가요 */}
          <div className="flex items-center gap-2 rounded-xl border border-[#f6e7c4] bg-[#fffbf1] px-6 py-5 text-[13px] text-[#3a4256]">
            <StarIcon size={16} />
            아직 받은 평가가 없어요
          </div>
          <p className="mt-2.5 text-xs leading-[18px] text-[#8c94ab]">평가는 함께한 연구자가 협업이 끝난 뒤 남겨요</p>
          <ul className="mt-2">
            {collaborations.map((item, index) => (
              <li key={index} className="grid gap-y-1 border-b border-[#eeeff4] py-6 last:border-b-0 lg:grid-cols-[140px_1fr]">
                <p className="text-[13px] leading-6 text-[#8c94ab]">{periodLabel(item)}</p>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base leading-6 text-ink">{item.title}</h3>
                    {item.category_ids.map((id) => (
                      <span key={id} className="rounded-[5px] bg-[#e3f4f6] px-[7px] py-[3px] text-[11px] leading-4 text-[#0f7c8c]">
                        {names.categories.get(id)}
                      </span>
                    ))}
                  </div>
                  <p className="mt-1.5 flex items-center gap-1.5 text-[13px] leading-[19px] text-[#5e6678]">
                    <Initial name={item.partner_nickname} />
                    {item.partner_nickname} 님과 함께
                  </p>
                  <dl className="mt-2 grid grid-cols-[76px_1fr] text-[13px] leading-5">
                    <dt className="pt-0.5 text-[#8c94ab]">AI로 한 일</dt>
                    <dd>
                      <Chips items={item.able_work_ids.map((id) => names.works.get(id) ?? "")} tone="brand" />
                    </dd>
                  </dl>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="mt-10 flex items-baseline gap-2">
        <h3 className="text-base leading-6 text-ink">포트폴리오 {profile.portfolios.length}</h3>
        <span className="text-xs text-[#8c94ab]">서비스 밖에서 해 온 일</span>
      </div>
      <ul className="mt-2">
        {profile.portfolios.map((item, index) => (
          <li key={item.portfolio_id} className="grid gap-y-1 border-b border-[#eeeff4] py-5 last:border-b-0 lg:grid-cols-[140px_1fr]">
            <p className="text-[13px] leading-6 text-[#8c94ab]">포트폴리오 {index + 1}</p>
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-base leading-6 text-ink">{item.title}</h3>
                <span className={`flex items-center gap-1.5 text-[13px] ${item.has_pdf ? "text-[#4b3fd6]" : "text-[#a0a6b8]"}`}>
                  <FileIcon />
                  {item.has_pdf ? "PDF 있음" : "PDF 없음"}
                </span>
              </div>
              <dl className="mt-2 grid grid-cols-[76px_1fr] gap-y-2 text-[13px] leading-5">
                <dt className="pt-0.5 text-[#8c94ab]">AI로 한 일</dt>
                <dd>
                  <Chips items={item.able_work_ids.map((id) => names.works.get(id) ?? "")} tone="brand" />
                </dd>
                {item.skills.length > 0 && (
                  <>
                    <dt className="text-[#8c94ab]">사용 기술</dt>
                    <dd className="text-[#2a3350]">{item.skills.join(", ")}</dd>
                  </>
                )}
                <dt className="text-[#8c94ab]">내 역할</dt>
                <dd className="break-words text-[#2a3350]">{item.role}</dd>
              </dl>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

function HistoryTab({ profile }: { profile: ExpertPublicProfile }) {
  const groups = [
    {
      label: "경력",
      rows: profile.careers.map((item) => ({
        key: item.career_id,
        when: `${formatMonth(item.start_month)} ~ ${item.end_month ? formatMonth(item.end_month) : "재직 중"}`,
        what: [item.company, item.job].filter(Boolean).join(" · "),
      })),
    },
    {
      label: "학력",
      rows: profile.educations.map((item) => ({ key: item.education_id, when: item.graduated_year ? `${item.graduated_year} 졸업` : "", what: `${item.school} · ${item.major}` })),
    },
    {
      label: "자격증",
      rows: profile.certificates.map((item) => ({ key: item.certificate_id, when: item.acquired_year ? `${item.acquired_year} 취득` : "", what: [item.name, item.issuer].filter(Boolean).join(" · ") })),
    },
  ].filter((group) => group.rows.length > 0); // 적은 것만 보여요

  return (
    <div className="lg:pt-3">
      {groups.map((group) => (
        <section key={group.label} className="grid gap-y-1 border-b border-[#eeeff4] py-5 first:pt-0 last:border-b-0 lg:grid-cols-[140px_1fr]">
          <h3 className="text-sm leading-6 text-[#3a4256]">{group.label}</h3>
          <dl className="grid gap-y-2.5">
            {group.rows.map((row) => (
              <div key={row.key} className="grid gap-x-4 sm:grid-cols-[150px_1fr]">
                <dt className="text-[13px] leading-6 text-[#8c94ab]">{row.when || "-"}</dt>
                <dd className="text-[15px] leading-6 text-ink">{row.what}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  );
}

/* ---------- 오른쪽 카드 조각 ---------- */

/** 마친 연구 분야 도넛 + 함께한 연구에서 한 일 */
function FieldSummary({ finished, names }: { finished: ExpertCollaboration[]; names: Names }) {
  if (finished.length === 0) {
    return (
      <div className="flex gap-2.5 rounded-xl bg-[#f5f7fc] p-4 text-xs leading-[18px] text-[#6b7285]">
        <InfoIcon />
        <p>
          아직 이 서비스에서 마친 협업이 없어요
          <br />
          협업이 끝나면 분야가 여기에 쌓여요
        </p>
      </div>
    );
  }
  const counts = countByCategory(finished);
  const works = [...new Set(finished.flatMap((item) => item.able_work_ids))].map((id) => names.works.get(id)).filter(Boolean);
  return (
    <div className="rounded-xl bg-[#f5f7fc] p-4">
      <div className="flex items-center gap-5">
        <Donut total={finished.length} counts={counts.map((item) => item.count)} />
        <ul className="grid flex-1 gap-2 text-xs leading-[18px]">
          {counts.map((item, index) => (
            <li key={item.id} className="flex items-center gap-1.5">
              <i className="size-2 shrink-0 rounded-full" style={{ background: DONUT_COLORS[index % DONUT_COLORS.length] }} />
              <span className="flex-1 text-[#3a4256]">{names.categories.get(item.id)}</span>
              <span className="text-ink">{item.count}건</span>
            </li>
          ))}
        </ul>
      </div>
      {works.length > 0 && (
        <div className="mt-4 border-t border-[#e3e7f1] pt-2.5">
          <p className="text-[11px] leading-4 text-[#8c94ab]">함께한 연구에서 한 일</p>
          <p className="mt-1 text-xs leading-[18px] text-[#3a4256]">{works.join(" · ")}</p>
        </div>
      )}
    </div>
  );
}

/** 도넛: 분야별 건수 비율. 가운데에 마친 연구 수. 한 연구가 분야 여러 개면 분야마다 셉니다. */
function Donut({ total, counts }: { total: number; counts: number[] }) {
  const radius = 44;
  const length = 2 * Math.PI * radius;
  const sum = counts.reduce((a, b) => a + b, 0) || 1;
  let offset = 0;
  return (
    <div className="relative size-[104px] shrink-0">
      <svg viewBox="0 0 104 104" className="size-full -rotate-90">
        {counts.map((count, index) => {
          const part = (count / sum) * length;
          const circle = (
            <circle key={index} cx="52" cy="52" r={radius} fill="none" stroke={DONUT_COLORS[index % DONUT_COLORS.length]} strokeWidth="16" strokeDasharray={`${part} ${length - part}`} strokeDashoffset={-offset} />
          );
          offset += part;
          return circle;
        })}
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-xl font-bold text-ink">{total}건</span>
    </div>
  );
}

function Conditions({ profile }: { profile: ExpertPublicProfile }) {
  const condition = profile.collaboration;
  return (
    <div className="rounded-xl border border-[#e6e1ff] bg-[#f8f7ff] px-[17px] py-[15px] text-[13px] leading-[19px]">
      <p className="text-[#3d33b8]">협업 조건</p>
      {condition ? (
        <dl className="mt-2.5 grid grid-cols-[114px_1fr] gap-y-[9px]">
          <dt className="text-[#8c94ab]">미팅</dt>
          <dd className="text-ink">
            {MEETING_LABELS[condition.meeting_type]}
            {condition.face_to_area ? ` · ${condition.face_to_area}` : ""}
          </dd>
          <dt className="text-[#8c94ab]">주당 시간</dt>
          <dd className="text-ink">{TIME_LABELS[condition.available_time]}</dd>
          <dt className="text-[#8c94ab]">희망 보상</dt>
          <dd className="text-ink">{condition.rewards.map((code) => REWARD_LABELS[code]).join(", ")}</dd>
        </dl>
      ) : (
        <p className="mt-2 text-[#8c94ab]">아직 적지 않았어요</p>
      )}
    </div>
  );
}

/* ---------- 작은 조각 ---------- */

function BackLink() {
  return (
    <Link href="/experts" className="inline-flex items-center gap-1 text-[13px] leading-5 text-[#5e6678] hover:text-ink">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
        <path d="M10 4 6 8l4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      AI 전문가 찾기로 돌아가기
    </Link>
  );
}

function EngagedBadge({ until }: { until: string | null }) {
  return (
    <span className="inline-flex h-6 items-center gap-[5px] rounded-[7px] bg-[#fff4e0] pr-[9px] pl-2 text-xs text-[#b26a00]">
      <i className="size-1.5 rounded-full bg-[#e08a2e]" />
      참여 중{until ? ` · ${monthDay(until)} 종료 예정` : ""}
    </span>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`-mb-px border-b-2 pb-3 text-[13px] leading-5 lg:text-[15px] lg:leading-[22px] ${active ? "border-[#4b3fd6] text-[#3d33b8]" : "border-transparent text-[#8c94ab] hover:text-[#5e6678]"}`}
    >
      {children}
    </button>
  );
}

function Chips({ items, tone }: { items: string[]; tone: "brand" | "teal" }) {
  const shown = items.filter(Boolean);
  const color = tone === "brand" ? "bg-[#eeebff] text-[#4b3fd6]" : "bg-[#e3f4f6] text-[#0f7c8c]";
  return (
    <ul className="flex flex-wrap gap-[5px]">
      {shown.map((name) => (
        <li key={name} className={`rounded-[5px] px-2 py-[3px] text-xs leading-[18px] ${color}`}>
          {name}
        </li>
      ))}
    </ul>
  );
}

function ChipRow({ label, items, tone }: { label: string; items: string[]; tone: "brand" | "teal" }) {
  return (
    <div className="grid gap-2 lg:grid-cols-[88px_1fr] lg:items-start">
      <dt className="text-xs leading-6 text-[#8c94ab]">{label}</dt>
      <dd>
        <Chips items={items} tone={tone} />
      </dd>
    </div>
  );
}

/** 함께한 연구회원 첫 글자 동그라미 */
function Initial({ name }: { name: string }) {
  const color = PARTNER_COLORS[[...name].reduce((sum, char) => sum + char.charCodeAt(0), 0) % PARTNER_COLORS.length];
  return (
    <span className="inline-flex size-[18px] items-center justify-center rounded-full text-[8px] text-white" style={{ background: color }}>
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

function LinkIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M6 8a2.5 2.5 0 0 0 3.5 0l2-2A2.5 2.5 0 0 0 8 2.5l-.6.6M8 6a2.5 2.5 0 0 0-3.5 0l-2 2A2.5 2.5 0 0 0 6 11.5l.6-.6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M14 2 7 9M14 2l-4.5 12L7 9 2 6.5 14 2Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="mt-0.5 shrink-0 text-[#8c94ab]" aria-hidden>
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M8 1.5H4a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-7L8 1.5Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M8 1.5v3h3" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  );
}

function StarIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden>
      <path d="m8 1.5 1.9 4 4.4.5-3.3 3 .9 4.4L8 11.2l-3.9 2.2.9-4.4-3.3-3 4.4-.5L8 1.5Z" fill="#f5a524" />
    </svg>
  );
}
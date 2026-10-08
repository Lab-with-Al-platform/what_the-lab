"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ExpertRequestDialog } from "@/components/expert-request-dialog";
import { PageContainer } from "@/components/page-container";
import { EXPERT_SAMPLE_NOTICE, fieldStats, type ExpertProfile, type FieldStat } from "@/lib/experts";

interface ExpertDetailProps {
  expert: ExpertProfile;
  related: ExpertProfile[];
}

type DetailTab = "research" | "conditions" | "reviews";

const TABS: { id: DetailTab; label: string }[] = [
  { id: "research", label: "연구 경험" },
  { id: "conditions", label: "협업 조건" },
  { id: "reviews", label: "협업 평가" },
];

const FIELD_COLORS = ["var(--color-brand)", "var(--color-expert)", "var(--color-trend)"];

/** 시안 오른쪽 카드의 원그래프입니다. 가운데 숫자는 분야별 건수의 합입니다. */
function FieldChart({ stats }: { stats: FieldStat[] }) {
  const total = stats.reduce((sum, stat) => sum + stat.count, 0);
  if (total === 0) {
    return null;
  }

  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  let traveled = 0;
  const summary = stats.map((stat) => `${stat.label} ${stat.count}건`).join(", ");

  return (
    <figure className="mt-4">
      <figcaption className="text-sm font-semibold">참여 연구 분야</figcaption>
      <div className="mt-3 flex items-center gap-4">
        <svg viewBox="0 0 100 100" className="h-28 w-28 shrink-0" role="img" aria-label={`연구 ${total}건. ${summary}`}>
          {stats.map((stat, index) => {
            const length = (stat.count / total) * circumference;
            const circle = (
              <circle
                key={stat.label}
                cx="50"
                cy="50"
                r={radius}
                fill="none"
                stroke={FIELD_COLORS[index % FIELD_COLORS.length]}
                strokeWidth="12"
                strokeDasharray={`${length} ${circumference - length}`}
                strokeDashoffset={-traveled}
                transform="rotate(-90 50 50)"
              />
            );
            traveled += length;
            return circle;
          })}
          <text x="50" y="54" textAnchor="middle" fill="var(--color-ink)" fontSize="16" fontWeight="700">
            {total}건
          </text>
        </svg>
        <ul className="space-y-2 text-sm">
          {stats.map((stat, index) => (
            <li key={stat.label} className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: FIELD_COLORS[index % FIELD_COLORS.length] }} aria-hidden="true" />
              <span className="text-muted">{stat.label}</span>
              <span className="font-semibold">{stat.count}건</span>
            </li>
          ))}
        </ul>
      </div>
      <p className="mt-2 text-[11px] leading-5 text-faint">분야 비율은 이 화면의 연구 경험 예시를 기준으로 나눈 값입니다.</p>
    </figure>
  );
}

/** 상세는 목록과 같은 사람을 보여 줍니다. 탭만 이 화면에서 바꿉니다. */
export function ExpertDetail({ expert, related }: ExpertDetailProps) {
  const [tab, setTab] = useState<DetailTab>("research");
  const [requestOpen, setRequestOpen] = useState(false);
  const avatarTone = expert.tone === "expert" ? "bg-expert-soft text-expert" : "bg-brand-soft text-brand";
  const statusTone = expert.availability === "available" ? "text-expert" : "text-trend";
  const startLabel = expert.availability === "available" ? "즉시 · 일정 협의" : "참여 중인 연구 종료 후 협의";

  useEffect(() => {
    if (window.location.hash === "#collaborate") {
      setRequestOpen(true);
    }
  }, []);

  return (
    <PageContainer className="py-6 md:py-8">
      <p className="text-xs">
        <Link href="/experts" className="font-semibold text-brand hover:underline">
          ← AI 전문가 찾기로 돌아가기
        </Link>
      </p>
      <nav aria-label="경로" className="mt-3 text-xs text-muted">
        <Link href="/" className="hover:text-ink">
          홈
        </Link>
        <span className="mx-1.5">›</span>
        <Link href="/experts" className="hover:text-ink">
          AI 전문가 찾기
        </Link>
        <span className="mx-1.5">›</span>
        <span className="text-ink">전문가 상세</span>
      </nav>
      <p className="mt-4 text-xs leading-5 text-faint">{EXPERT_SAMPLE_NOTICE}</p>

      <div className="mt-6 xl:grid xl:grid-cols-[minmax(0,1fr)_300px] xl:items-start xl:gap-6">
        <section className="rounded-card border border-line bg-card p-5 shadow-card md:p-8">
          <div className="flex items-center gap-4">
            <span className={`grid h-16 w-16 shrink-0 place-items-center rounded-full text-lg font-bold ${avatarTone}`} aria-hidden="true">
              {expert.initial}
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-[28px] font-bold tracking-tight">{expert.name}</h1>
                <button
                  type="button"
                  className="h-8 rounded-full border border-line px-3 text-xs font-semibold text-muted hover:bg-page"
                  onClick={() => navigator.clipboard?.writeText(window.location.href)}
                >
                  링크 복사
                </button>
              </div>
              <p className={`mt-1 text-xs font-semibold ${statusTone}`}>● {expert.status}</p>
              <p className="mt-1 text-sm leading-6 text-muted">
                {expert.title}
                <br />
                {expert.affiliation}
              </p>
            </div>
          </div>
          <ul className="mt-4 flex flex-wrap gap-2">
            {expert.tasks.map((task) => (
              <li key={task} className="rounded-full bg-brand-soft px-3 py-1 text-xs font-medium text-brand">
                {task}
              </li>
            ))}
            <li className="rounded-full bg-page px-3 py-1 text-xs text-muted">{expert.tech.split(" · ")[0]}</li>
          </ul>
          <div className="mt-5 rounded-card bg-brand-soft p-5">
            <h2 className="text-base font-bold">이런 역할을 맡을 수 있어요</h2>
            <p className="mt-2 text-sm leading-7 text-muted">{expert.intro}</p>
            <ul className="mt-3 space-y-2 text-sm">
              {expert.canHelp.map((item) => (
                <li key={item}>✓ {item}</li>
              ))}
            </ul>
          </div>
          <dl className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-card bg-page px-4 py-3">
              <dt className="text-xs text-faint">완료한 연구</dt>
              <dd className="mt-1 text-xl font-bold">{expert.researchCount}건</dd>
            </div>
            <div className="rounded-card bg-page px-4 py-3">
              <dt className="text-xs text-faint">학술 논문</dt>
              <dd className="mt-1 text-xl font-bold">{expert.paperCount}편</dd>
            </div>
            <div className="rounded-card bg-page px-4 py-3">
              <dt className="text-xs text-faint">참여한 연구 분야</dt>
              <dd className="mt-1 text-sm font-bold">{expert.domains.join(" · ")}</dd>
            </div>
          </dl>
        </section>

        <aside className="mt-4 space-y-4 xl:mt-0">
          <section id="collaborate" className="rounded-card border border-line bg-card p-5 shadow-card">
            <h2 className="text-base font-bold">{expert.name} 님과 함께하기</h2>
            <FieldChart stats={fieldStats(expert)} />
            <p className={`mt-4 text-xs font-semibold ${statusTone}`}>● {expert.status}</p>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between gap-3 border-b border-line pb-3">
                <dt className="text-muted">참여 가능 시점</dt>
                <dd className="text-right font-medium">{startLabel}</dd>
              </div>
              <div className="flex justify-between gap-3 border-b border-line pb-3">
                <dt className="text-muted">선호 방식</dt>
                <dd className="text-right font-medium">온라인 · 주 1회 회의</dd>
              </div>
              <div className="flex justify-between gap-3 border-b border-line pb-3">
                <dt className="text-muted">가능 시간</dt>
                <dd className="text-right font-medium">주 4~6시간</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">데이터 조건</dt>
                <dd className="text-right font-medium">비식별화 데이터</dd>
              </div>
            </dl>
            <p className="mt-4 text-sm leading-6 text-muted">
              협업 요청은 연구자가 전문가에게 보내는 길입니다. 로그인과 요청 저장은 아직 연결되지 않아, 이 화면에서는 보내지 않습니다.
            </p>
            <button type="button" className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-button bg-brand text-sm font-semibold text-white hover:bg-brand-hover" onClick={() => setRequestOpen(true)}>
              협업 요청하기
            </button>
            <p className="mt-4 text-center text-xs text-faint">요청 전달 → 의사 확인 → 협업 확정</p>
            <p className="mt-2 text-center text-xs text-faint">연락처는 서로 협업 의사를 확인한 뒤에만 공개됩니다.</p>
          </section>

          {related.length > 0 ? (
            <section className="rounded-card border border-line bg-card p-5 shadow-card">
              <h2 className="text-base font-bold">함께 살펴볼 전문가</h2>
              <ul className="mt-3 space-y-3">
                {related.map((item) => (
                  <li key={item.slug}>
                    <Link href={`/experts/${item.slug}`} className="flex items-center gap-3 rounded-card hover:text-brand">
                      <span className="grid h-10 w-10 place-items-center rounded-full bg-brand-soft text-sm font-bold text-brand" aria-hidden="true">
                        {item.initial}
                      </span>
                      <span>
                        <span className="block text-sm font-semibold">{item.name}</span>
                        <span className="block text-xs text-muted">{item.title}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </aside>

        <section className="mt-4 rounded-card border border-line bg-card p-5 shadow-card md:p-8 xl:mt-0">
          <div role="tablist" aria-label="전문가 상세 정보" className="flex gap-4 border-b border-line">
            {TABS.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={tab === item.id}
                className={`min-h-11 border-b-2 text-sm font-semibold ${tab === item.id ? "border-brand text-brand" : "border-transparent text-muted"}`}
                onClick={() => setTab(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>

          {tab === "research" ? (
            <div className="mt-6" role="tabpanel">
              <h2 className="text-xl font-bold">함께 완주한 연구</h2>
              <p className="mt-2 text-sm text-muted">연구 경험과 실제로 맡은 역할을 함께 확인해 보세요. 아래 내용은 예시입니다.</p>
              <ul className="mt-4 divide-y divide-line">
                {expert.projects.map((project) => (
                  <li key={project.title} className="py-5">
                    <p className="text-xs text-faint">{project.period}</p>
                    <h3 className="mt-1 font-bold">{project.title}</h3>
                    <p className="mt-2 inline-flex rounded-full bg-brand-soft px-2.5 py-1 text-xs text-brand">{project.field}</p>
                    <p className="mt-2 text-sm text-muted">{project.organization}</p>
                    <p className="mt-2 text-sm leading-6">
                      <b>맡은 역할</b> {project.role}
                      <br />
                      <b>연구 성과</b> {project.outcome}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {tab === "conditions" ? (
            <div className="mt-6" role="tabpanel">
              <h2 className="text-xl font-bold">함께 일하기 좋은 조건</h2>
              <p className="mt-2 text-sm text-muted">시안에 있던 예시 조건입니다. 협업 요청 전에 확인할 항목으로만 읽어 주세요.</p>
              <dl className="mt-4 divide-y divide-line">
                {expert.conditions.map((condition) => (
                  <div key={condition.label} className="grid gap-1 py-3 sm:grid-cols-[140px_minmax(0,1fr)]">
                    <dt className="text-sm font-semibold">{condition.label}</dt>
                    <dd className="text-sm text-muted">{condition.value}</dd>
                  </div>
                ))}
              </dl>
              <div id="request-guide" className="mt-4 rounded-card bg-brand-soft p-5">
                <h3 className="font-bold">협업 요청에 이런 내용을 담아주세요</h3>
                <p className="mt-2 text-sm leading-7 text-muted">
                  연구 목표와 풀고 싶은 질문
                  <br />
                  보유 데이터의 종류·규모·라벨 여부
                  <br />
                  기대하는 전문가 역할과 예상 일정
                  <br />
                  성과 활용 계획과 연구팀의 협의 조건
                </p>
              </div>
            </div>
          ) : null}

          {tab === "reviews" ? (
            <div className="mt-6" role="tabpanel">
              <h2 className="text-xl font-bold">함께한 연구팀의 평가</h2>
              <p className="mt-3 text-sm leading-7 text-muted">
                평가는 완료된 협업이 있을 때만 보여 줍니다. 이 화면의 연구 이력은 예시라서 별점과 후기를 만들지 않았습니다.
              </p>
            </div>
          ) : null}
        </section>
      </div>
      {requestOpen ? <ExpertRequestDialog expert={expert} onClose={() => setRequestOpen(false)} /> : null}
    </PageContainer>
  );
}

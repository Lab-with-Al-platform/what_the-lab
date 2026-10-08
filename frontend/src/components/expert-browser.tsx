"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";
import { ExpertCard } from "@/components/expert-card";
import { PageContainer } from "@/components/page-container";
import { EXPERT_SAMPLE_NOTICE, matchesExpertQuery, type ExpertProfile } from "@/lib/experts";

interface ExpertBrowserProps {
  experts: ExpertProfile[];
  tasks: string[];
  domains: string[];
}

/** 검색·필터는 주소에 남겨, 사례 글의 기술 링크와 새로고침이 같은 목록을 보게 합니다. */
export function ExpertBrowser({ experts, tasks, domains }: ExpertBrowserProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [taskOpen, setTaskOpen] = useState(false);
  const query = searchParams.get("q") ?? searchParams.get("skill") ?? "";
  const task = searchParams.get("task") ?? "all";
  const domain = searchParams.get("domain") ?? "all";
  const availableOnly = searchParams.get("available") === "1";

  const visible = experts
    .filter((expert) => (availableOnly ? expert.availability === "available" : true))
    .filter((expert) => (task === "all" ? true : expert.tasks.includes(task)))
    .filter((expert) => (domain === "all" ? true : expert.domains.includes(domain)))
    .filter((expert) => (query.trim() ? matchesExpertQuery(expert, query) : true))
    .sort((left, right) => {
      if (left.availability !== right.availability) {
        return left.availability === "available" ? -1 : 1;
      }
      return left.name.localeCompare(right.name, "ko");
    });

  function replaceFilters(next: { q?: string; task?: string; domain?: string; available?: boolean }) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("skill");
    const q = next.q ?? query;
    const nextTask = next.task ?? task;
    const nextDomain = next.domain ?? domain;
    const nextAvailable = next.available ?? availableOnly;

    if (q.trim()) {
      params.set("q", q.trim());
    } else {
      params.delete("q");
    }
    if (nextTask !== "all") {
      params.set("task", nextTask);
    } else {
      params.delete("task");
    }
    if (nextDomain !== "all") {
      params.set("domain", nextDomain);
    } else {
      params.delete("domain");
    }
    if (nextAvailable) {
      params.set("available", "1");
    } else {
      params.delete("available");
    }

    const text = params.toString();
    router.replace(text ? `/experts?${text}` : "/experts", { scroll: false });
  }

  function onSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    replaceFilters({ q: String(formData.get("q") ?? "") });
  }

  return (
    <PageContainer className="py-8 md:py-10">
      <p className="text-xs text-muted">
        <Link href="/" className="hover:text-ink">
          홈
        </Link>
        <span className="mx-1.5">›</span>
        AI 전문가 찾기
      </p>
      <p className="mt-6 text-[11px] font-semibold tracking-[0.18em] text-brand uppercase">Find experts · Research collaboration</p>
      <h1 className="mt-3 text-[32px] leading-tight font-bold tracking-tight md:text-[40px]">
        연구의 다음 단계를,
        <br />
        <span className="text-brand">함께할 AI 전문가</span>
      </h1>
      <p className="mt-4 text-sm leading-7 text-muted">
        기술 이름을 몰라도 괜찮아요.
        <br />
        연구 주제나 해결하고 싶은 일로 함께할 전문가를 찾아보세요.
      </p>
      <p className="mt-3 text-xs leading-5 text-faint">{EXPERT_SAMPLE_NOTICE}</p>

      <section className="mt-6 rounded-card border border-line bg-card p-4 shadow-card md:p-5" aria-label="전문가 검색">
        <form className="flex flex-col gap-2 sm:flex-row" onSubmit={onSearch}>
          <label className="sr-only" htmlFor="expert-query">
            연구 주제나 맡길 일 검색
          </label>
          <input
            id="expert-query"
            name="q"
            key={query}
            defaultValue={query}
            placeholder="예: 세포 이미지 분석, 데이터 정리"
            className="h-11 flex-1 rounded-button border border-line px-4 text-sm"
          />
          <button type="submit" className="h-11 rounded-button bg-brand px-5 text-sm font-semibold text-white hover:bg-brand-hover">
            검색
          </button>
        </form>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            aria-expanded={taskOpen}
            className="inline-flex h-11 items-center rounded-button border border-line bg-white px-3 text-sm"
            onClick={() => setTaskOpen((open) => !open)}
          >
            {task === "all" ? "무엇을 맡길까요?" : task}
          </button>
          <label className="sr-only" htmlFor="expert-domain">
            어떤 연구 분야인가요?
          </label>
          <select
            id="expert-domain"
            className="h-11 rounded-button border border-line bg-white px-3 text-sm"
            value={domain}
            onChange={(event) => replaceFilters({ domain: event.target.value })}
          >
            <option value="all">어떤 연구 분야인가요?</option>
            {domains.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <button
            type="button"
            aria-pressed={availableOnly}
            className={`inline-flex h-11 items-center rounded-button border px-3 text-sm ${
              availableOnly ? "border-brand bg-brand text-white" : "border-line bg-white"
            }`}
            onClick={() => replaceFilters({ available: !availableOnly })}
          >
            바로 참여 가능
          </button>
          <p className="text-xs text-faint">연구 분야와 할 수 있는 일을 구분해 찾아보세요.</p>
        </div>
        {taskOpen ? (
          <div className="mt-3 rounded-card border border-line bg-page p-3">
            <p className="text-xs text-muted">맡길 일을 고르면 목록이 바로 바뀝니다. 다시 누르면 해제됩니다.</p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {tasks.map((item) => (
                <li key={item}>
                  <button
                    type="button"
                    aria-pressed={task === item}
                    className={`min-h-11 rounded-full px-3 text-sm ${task === item ? "bg-brand text-white" : "border border-line bg-white"}`}
                    onClick={() => replaceFilters({ task: task === item ? "all" : item })}
                  >
                    {item}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {query || task !== "all" || domain !== "all" || availableOnly ? (
          <ul className="mt-3 flex flex-wrap gap-2">
            {query ? <li><FilterChip label={query} onClear={() => replaceFilters({ q: "" })} /></li> : null}
            {task !== "all" ? <li><FilterChip label={task} onClear={() => replaceFilters({ task: "all" })} /></li> : null}
            {domain !== "all" ? <li><FilterChip label={domain} onClear={() => replaceFilters({ domain: "all" })} /></li> : null}
            {availableOnly ? <li><FilterChip label="바로 참여 가능" onClear={() => replaceFilters({ available: false })} /></li> : null}
          </ul>
        ) : null}
      </section>

      <div className="mt-8 flex flex-wrap items-end justify-between gap-2">
        <h2 className="text-xl font-bold">
          함께할 전문가 <span className="text-brand">{visible.length}명</span>
        </h2>
        <p className="text-xs text-faint">참여 가능 상태 우선 · 화면 시안용 예시</p>
      </div>

      {visible.length === 0 ? (
        <p className="mt-5 rounded-card border border-line bg-card px-5 py-10 text-sm text-muted">
          조건에 맞는 전문가가 없습니다.{" "}
          <button type="button" className="font-semibold text-brand" onClick={() => replaceFilters({ q: "", task: "all", domain: "all", available: false })}>
            필터 지우기
          </button>
        </p>
      ) : (
        <div className="mt-5 grid items-stretch gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((expert) => (
            <ExpertCard key={expert.slug} expert={expert} activeTask={task === "all" ? "" : task} />
          ))}
        </div>
      )}
    </PageContainer>
  );
}

function FilterChip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <button type="button" className="inline-flex h-8 items-center gap-1 rounded-full bg-brand-soft px-3 text-xs font-semibold text-brand" onClick={onClear}>
      {label}
      <span aria-hidden="true">×</span>
      <span className="sr-only">필터 해제</span>
    </button>
  );
}

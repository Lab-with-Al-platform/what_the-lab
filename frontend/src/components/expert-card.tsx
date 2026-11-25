import Link from "next/link";
import type { ExpertProfile } from "@/lib/experts";

interface ExpertCardProps {
  expert: ExpertProfile;
  /** 목록에서 고른 할 일. 같은 태그만 채워 보여 줍니다. */
  activeTask?: string;
}

const AVATAR_TONES = ["bg-brand-soft text-brand", "bg-expert-soft text-expert", "bg-trend-soft text-trend"];

/** 같은 사람은 새로고침해도 같은 색 원을 씁니다. */
function avatarTone(name: string): string {
  const code = [...name].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return AVATAR_TONES[code % AVATAR_TONES.length];
}

/** 목록 카드입니다. 프로필은 상세로, 협업 요청은 상세의 안내 창으로 갑니다. */
export function ExpertCard({ expert, activeTask = "" }: ExpertCardProps) {
  const visibleTasks = expert.tasks.slice(0, 2);
  const hiddenCount = expert.tasks.length - visibleTasks.length;
  const statusTone = expert.availability === "available" ? "text-expert" : "text-trend";

  return (
    <article className="flex h-full flex-col rounded-card border border-line bg-card p-5 shadow-card">
      <div className="flex items-start gap-3">
        <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-full text-sm font-bold ${avatarTone(expert.name)}`} aria-hidden="true">
          {expert.initial}
        </span>
        <div className="min-w-0">
          <h3 className="text-base font-bold">
            <Link href={`/experts/${expert.slug}`} className="hover:text-brand">
              {expert.name}
            </Link>
          </h3>
          <p className="truncate text-sm text-muted">{expert.title}</p>
        </div>
      </div>
      <p className="mt-3 line-clamp-2 min-h-[2lh] text-sm leading-6">{expert.summary}</p>
      <ul className="mt-3 flex flex-wrap gap-1.5">
        {visibleTasks.map((task) => (
          <li
            key={task}
            className={`rounded-full px-2.5 py-1 text-xs font-medium ${
              task === activeTask ? "bg-brand text-white" : "bg-brand-soft text-brand"
            }`}
          >
            {task}
          </li>
        ))}
        {hiddenCount > 0 ? <li className="rounded-full bg-page px-2.5 py-1 text-xs text-muted">+{hiddenCount}</li> : null}
      </ul>
      <p className={`mt-3 text-xs font-semibold ${statusTone}`}>
        <span aria-hidden="true">● </span>
        {expert.status}
      </p>
      <div className="mt-auto grid grid-cols-2 gap-2 pt-4">
        <Link href={`/experts/${expert.slug}`} className="inline-flex h-11 items-center justify-center rounded-button border border-line text-sm font-semibold hover:bg-page">
          프로필 보기
        </Link>
        <Link href={`/experts/${expert.slug}#collaborate`} className="inline-flex h-11 items-center justify-center rounded-button bg-brand text-sm font-semibold text-white hover:bg-brand-hover">
          협업 요청
        </Link>
      </div>
    </article>
  );
}

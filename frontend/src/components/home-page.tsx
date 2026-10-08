import Image from "next/image";
import Link from "next/link";
import { InsightCard } from "@/components/insight-card";
import { PageContainer } from "@/components/page-container";
import { InterviewPanel } from "@/components/interview-panel";
import { landingInsights } from "@/lib/insights";

function topicHref(path: string, key: string, value: string): string {
  return `${path}?${key}=${encodeURIComponent(value)}`;
}

const ENTRY_CARDS = [
  {
    href: "/cases",
    image: "/generated/research-cases-card-v1.png",
    imageClass: "opacity-95",
    kicker: "AI RESEARCH CASES",
    title: "AI 연구 협업 사례",
    body: "실제 연구에서 AI를 어떻게 활용했는지 생생한 사례를 확인해보세요.",
    accent: "text-brand",
    tags: [
      { label: "생명과학", href: topicHref("/cases", "topic", "생명과학") },
      { label: "신소재·화학", href: topicHref("/cases", "topic", "신소재·화학") },
      { label: "의료·헬스케어", href: topicHref("/cases", "topic", "의료·헬스케어") },
      { label: "기후·환경", href: topicHref("/cases", "topic", "기후·환경") },
    ],
  },
  {
    href: "/trends",
    image: "/generated/ai-trends-card-v1.png",
    imageClass: "opacity-95",
    kicker: "AI TRENDS",
    title: "AI 트렌드",
    body: "AI의 최신 기술과 연구 동향을 확인하고 연구에 적용할 아이디어를 찾아보세요.",
    accent: "text-trend",
    tags: [
      { label: "LLM·생성형 AI", href: topicHref("/trends", "topic", "LLM·생성형 AI") },
      { label: "시계열·예측", href: topicHref("/trends", "topic", "시계열·예측") },
      { label: "과학 AI", href: topicHref("/trends", "topic", "과학 AI") },
      { label: "오픈소스·도구", href: topicHref("/trends", "topic", "오픈소스·도구") },
    ],
  },
  {
    href: "/experts",
    image: "/generated/find-experts-card-v1.png",
    imageClass: "opacity-95",
    kicker: "FIND EXPERTS",
    title: "AI 전문가 찾기",
    body: "내 연구와 맞는 AI 기술을 가진 전문가를 찾아보세요.",
    accent: "text-expert",
    tags: [
      { label: "데이터 분석", href: topicHref("/experts", "skill", "데이터 분석") },
      { label: "컴퓨터 비전", href: topicHref("/experts", "skill", "컴퓨터 비전") },
      { label: "자연어 처리", href: topicHref("/experts", "skill", "자연어 처리") },
      { label: "머신러닝", href: topicHref("/experts", "skill", "머신러닝") },
    ],
  },
];

export function HomePage() {
  const latest = landingInsights();

  return (
    <div className="bg-white">
      <section className="relative overflow-hidden bg-[linear-gradient(90deg,#ffffff_0%,#ffffff_44%,#f4f6fb_100%)]">
      <PageContainer className="grid min-h-[378px] items-center gap-6 py-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:py-0">
        <div className="relative z-10 lg:pl-12">
          <p className="text-[11px] font-semibold tracking-[0.22em] text-faint">RESEARCH × AI × COLLABORATION</p>
          <h1 className="mt-5 text-[34px] leading-[1.16] font-bold tracking-[-0.035em] text-ink md:text-[50px]">
            연구의 질문이
            <br />
            AI와 만나는 곳, <span className="text-brand">LabBridge</span>
          </h1>
          <p className="mt-5 max-w-[520px] text-[15px] leading-7 text-ink/80">
            실제 연구사례와 최신 기술 동향을 통해
            <br className="hidden sm:block" />
            내 연구에 맞는 AI 아이디어를 발견하고, 함께할 AI 전문가를 찾아보세요.
          </p>
          <Link href="#paths" className="mt-5 inline-flex h-11 items-center gap-3 rounded-button bg-brand px-6 text-sm font-medium text-white shadow-[0_8px_20px_rgb(80_54_244_/_0.18)] transition hover:-translate-y-0.5 hover:bg-brand-hover">
            지금 시작하기
            <span aria-hidden="true">→</span>
          </Link>
        </div>
        <HeroCollage />
      </PageContainer>
      {/* 사진 끝이 카드와 만나며 생기던 가로선을 흰색으로 녹입니다. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-16 bg-gradient-to-b from-white/0 to-white" />
      </section>

      <PageContainer id="paths" className="grid gap-4 py-0 lg:grid-cols-3">
        {ENTRY_CARDS.map((card) => (
          <article key={card.href} className="relative flex h-full min-h-[214px] flex-col overflow-hidden rounded-card border border-line bg-card p-7 shadow-card">
            <Image
              src={card.image}
              alt=""
              fill
              sizes="(min-width: 1024px) 33vw, 100vw"
              className={`pointer-events-none object-cover object-center ${card.imageClass}`}
            />
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,#ffffff_0%,rgba(255,255,255,0.96)_42%,rgba(255,255,255,0.20)_78%,rgba(255,255,255,0.05)_100%)]" />
            <div className="relative">
              <p className={`text-[11px] font-semibold tracking-[0.16em] ${card.accent}`}>{card.kicker}</p>
              <div className="mt-3 flex items-start justify-between gap-3">
                <h2 className="text-[26px] font-bold tracking-tight">{card.title}</h2>
                <Link
                  href={card.href}
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-line bg-white text-ink"
                  aria-label={`${card.title}로 이동`}
                >
                  <span aria-hidden="true">→</span>
                </Link>
              </div>
              <p className="mt-2 max-w-[250px] text-sm leading-6 text-muted">{card.body}</p>
              <ul className="mt-5 flex flex-wrap gap-2">
                {card.tags.map((tag) => (
                  <li key={tag.label}>
                    <Link href={tag.href} className="inline-flex min-h-8 items-center rounded-full border border-line bg-white/80 px-3 text-xs text-muted hover:text-ink">
                      {tag.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </article>
        ))}
      </PageContainer>

      <PageContainer className="py-8" aria-labelledby="latest-heading">
        <div className="mb-5 flex items-end justify-between">
          <h2 id="latest-heading" className="text-2xl font-bold">
            최신 인사이트
          </h2>
          <Link href="/cases" className="text-sm font-semibold text-muted hover:text-ink">
            전체 보기
          </Link>
        </div>
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {latest.map((article) => (
              <InsightCard key={article.slug} article={article} variant="landing" />
            ))}
          </div>
          <InterviewPanel />
        </div>
      </PageContainer>
    </div>
  );
}

function HeroCollage() {
  return (
    <div className="relative -mr-[max(0px,calc((100vw-var(--layout-content))/2))] hidden h-[378px] lg:block">
      <div className="absolute inset-0 overflow-hidden">
        <Image
          src="/generated/labbridge-hero-v1.png"
          alt=""
          fill
          priority
          sizes="(min-width: 1024px) 58vw, 0px"
          className="object-cover object-center"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,#ffffff_0%,rgba(255,255,255,0.72)_11%,rgba(255,255,255,0)_34%)]" />
      </div>
      <FloatingNote
        className="absolute top-12 left-[26%] w-[152px]"
        title="Bioinformatics"
        body="단백질 구조 예측으로 신약 후보 물질 발굴"
      />
      <FloatingNote
        className="absolute top-12 right-[3%] w-[180px]"
        title="Medical AI"
        body="의료 영상 자료로 조기 진단 정확도 향상"
        titleClass="text-expert"
      />
      <FloatingNote
        className="absolute bottom-7 left-[26%] w-[160px]"
        title="Climate Tech"
        body="위성 영상 분석으로 기후 변화 예측"
      />
      <p className="absolute right-[4%] bottom-7 max-w-[156px] rounded-[8px] bg-white/72 px-3 py-2 text-xs leading-5 text-muted backdrop-blur-sm">
        연구의 가능성을 데이터와 AI로 확장합니다.
      </p>
    </div>
  );
}

function FloatingNote({
  className,
  title,
  body,
  titleClass = "text-ink",
}: {
  className: string;
  title: string;
  body: string;
  titleClass?: string;
}) {
  return (
    <div className={`${className} rounded-card border border-white/80 bg-white/88 p-3 shadow-card backdrop-blur-md`}>
      <p className={`text-[11px] font-semibold ${titleClass}`}>{title}</p>
      <p className="mt-1 text-[10px] leading-4 text-muted">{body}</p>
    </div>
  );
}

import Image, { getImageProps } from "next/image";
import Link from "next/link";
import { InsightCard } from "@/components/insight-card";
import { PageContainer } from "@/components/page-container";
import { InterviewPanel } from "@/components/interview-panel";
import { HomeHero } from "@/components/home-hero";
import { landingInsights } from "@/lib/insights";

function topicHref(path: string, key: string, value: string): string {
  return `${path}?${key}=${encodeURIComponent(value)}`;
}

const ENTRY_CARDS = [
  {
    href: "/cases",
    image: "/generated/research-cases-card-v1.jpg",
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
    image: "/generated/ai-trends-card-v1.jpg",
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
    image: "/generated/find-experts-card-v1.jpg",
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
      <HomeHero introVisual={<HeroCollage />} />

      <PageContainer id="paths" className="grid gap-4 py-0 lg:grid-cols-3">
        {ENTRY_CARDS.map((card) => (
          <article key={card.href} className="home-entry-card relative flex h-full min-h-[214px] flex-col overflow-hidden rounded-card border border-line bg-card p-7 shadow-card">
            <Image
              src={card.image}
              alt=""
              fill
              sizes="(min-width: 1440px) 460px, (min-width: 1024px) 33vw, 100vw"
              className={`home-entry-card__image pointer-events-none object-cover object-center ${card.imageClass}`}
            />
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,#ffffff_0%,rgba(255,255,255,0.96)_42%,rgba(255,255,255,0.20)_78%,rgba(255,255,255,0.05)_100%)]" />
            {/* 카드를 링크로 감싸면 키워드 링크가 중첩되므로 별도 링크로 둡니다. */}
            <Link href={card.href} className="home-entry-card__link absolute inset-0 z-10">
              <span className="sr-only">{card.title}로 이동</span>
            </Link>
            <div className="relative">
              <p className={`text-[11px] font-semibold tracking-[0.16em] ${card.accent}`}>{card.kicker}</p>
              <h2 className="mt-3 min-h-11 text-[26px] font-bold tracking-tight">{card.title}</h2>
              <p className="mt-2 max-w-[250px] text-sm leading-6 text-muted">{card.body}</p>
              <ul className="mt-5 flex flex-wrap gap-2">
                {card.tags.map((tag) => (
                  <li key={tag.label}>
                    <Link href={tag.href} className="home-entry-card__tag relative z-20 inline-flex min-h-8 items-center rounded-full border border-line bg-white/80 px-3 text-xs text-muted hover:text-ink">
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
  const sizes = "(min-width: 1440px) 920px, (min-width: 1024px) 65vw, 100vw";
  const { props } = getImageProps({
    src: "/generated/labbridge-hero-v1.jpg", alt: "", fill: true, sizes,
  });

  return (
    <div className="home-hero__collage home-hero__collage--intro">
      <div className="home-hero__guide-photo">
        <img
          src={props.src}
          srcSet={props.srcSet}
          sizes={sizes}
          alt=""
          loading="lazy"
          decoding="async"
          fetchPriority="high"
          className="absolute inset-0 h-full w-full object-cover object-center"
        />
        <div className="home-hero__guide-fade" />
      </div>
      <div className="home-hero__guide-notes">
        <div className="home-hero__note home-hero__note--intro-bio">
          <p className="home-hero__note-title">Bioinformatics</p>
          <p className="home-hero__note-body">단백질 구조 예측으로 신약 후보 물질 발굴</p>
        </div>
        <div className="home-hero__note home-hero__note--intro-med">
          <p className="home-hero__note-title text-expert">Medical AI</p>
          <p className="home-hero__note-body">의료 영상 자료로 조기 진단 정확도 향상</p>
        </div>
        <div className="home-hero__note home-hero__note--intro-climate">
          <p className="home-hero__note-title">Climate Tech</p>
          <p className="home-hero__note-body">위성 영상 분석으로 기후 변화 예측</p>
        </div>
        <p className="home-hero__note home-hero__note--intro-caption">연구의 가능성을 데이터와 AI로 확장합니다.</p>
      </div>
    </div>
  );
}

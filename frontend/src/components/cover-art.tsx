import Image from "next/image";
import type { CoverTheme } from "@/lib/insight-meta";

/**
 * 주제별 표지 사진입니다.
 * 연구 원본 그림이 아니라, 화면이 무슨 분야인지 보여 주는 사진입니다.
 */
const COVER_SRC: Record<CoverTheme, string> = {
  cells: "/photos/cells-render.jpg",
  biomass: "/generated/case-lettuce-biomass-v1.png",
  dental: "/generated/case-periodontal-xray-v1.png",
  concrete: "/generated/case-concrete-crack-v1.png",
  coScientist: "/generated/trend-co-scientist-v1.png",
  mattergen: "/generated/trend-mattergen-v1.png",
  alphaEvolve: "/generated/trend-alphaevolve-v1.png",
  medical: "/photos/histology.jpg",
  protein: "/photos/protein-render.jpg",
  molecule: "/photos/protein.jpg",
  turbines: "/photos/turbines-sunset.jpg",
  brain: "/photos/brain-network.jpg",
  climate: "/photos/turbines-sunset.jpg",
  solar: "/photos/solar.jpg",
  battery: "/photos/chart.jpg",
  flow: "/photos/pexel-scope.jpg",
  chart: "/photos/chart.jpg",
  script: "/photos/waves.jpg",
  audio: "/photos/waves.jpg",
  agent: "/photos/waves.jpg",
  food: "/photos/protein.jpg",
};

interface CoverArtProps {
  theme: CoverTheme;
  /** 같은 분야여도 서로 다른 글임을 구별할 수 있는 전용 표지입니다. */
  src?: string;
  /** 부모가 정한 칸을 채웁니다. 높이를 주지 않으면 사진이 0으로 줄어듭니다. */
  className: string;
  /** 실제 표시 폭을 브라우저에 알려 작은 칸에 큰 이미지를 받지 않게 합니다. */
  sizes: string;
  /** 첫 화면의 대표 표지에만 사용합니다. 나머지는 기본 지연 로딩입니다. */
  priority?: boolean;
  /** 상세 화면에서는 사진의 의미를 설명하고, 장식용 카드에서는 비워 둡니다. */
  alt?: string;
}

/**
 * 목록 카드 사진 칸입니다.
 * 원본 파일의 가로세로와 상관없이 16:9로 맞춥니다.
 * SCREEN_DESIGN_SPECS의 목록 카드 시작값입니다.
 */
export const INSIGHT_CARD_COVER_CLASS = "aspect-video w-full shrink-0";

export function CoverArt({ theme, src, className, sizes, priority = false, alt = "" }: CoverArtProps) {
  return (
    <div className={`relative overflow-hidden bg-page ${className}`}>
      {/* fill은 기존 사진 칸을 유지하고, 최적화된 크기·형식만 바꿔 전달합니다. */}
      <Image src={src ?? COVER_SRC[theme]} alt={alt} fill sizes={sizes} priority={priority} className="object-cover" />
    </div>
  );
}

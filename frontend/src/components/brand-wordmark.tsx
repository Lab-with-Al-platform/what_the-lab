import Image from "next/image";

const WORDMARKS = {
  header: { src: "/brand/labbridges-wordmark-header-v2.png", width: 686, height: 180 },
  hero: { src: "/brand/labbridges-wordmark-hero-v2.png", width: 1280, height: 360 },
} as const;

/** b 아치와 i 별이 들어간 워드마크. 헤더는 단일 아치, 대표 화면은 이중 아치입니다. */
export function BrandWordmark({
  variant = "header",
  height = 28,
  priority = false,
  alt = "LabBridges",
  className,
}: {
  variant?: "header" | "hero";
  height?: number;
  priority?: boolean;
  alt?: string;
  /** 넘길 때는 높이 클래스(h-…)도 함께 넘겨요. 예: "h-10 w-auto md:h-14" */
  className?: string;
}) {
  const asset = WORDMARKS[variant];
  const width = Math.round((height * asset.width) / asset.height);
  // 정적 빌드(S3)는 이미지 최적화를 꺼서 원본 PNG가 그대로 나가요.
  // 높이를 CSS로 고정하지 않으면 로고가 원본 크기로 커지므로, className이 없을 때는 style로 고정해요.
  const sizeStyle = className ? undefined : { height: `${height}px`, width: "auto" };
  return (
    <Image
      src={asset.src}
      alt={alt}
      width={width}
      height={height}
      priority={priority}
      className={className}
      style={sizeStyle}
    />
  );
}

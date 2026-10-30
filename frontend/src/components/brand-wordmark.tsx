import Image from "next/image";

const WORDMARKS = {
  header: { src: "/brand/labbridge-wordmark-header.png", width: 624, height: 180 },
  hero: { src: "/brand/labbridge-wordmark-hero.png", width: 1176, height: 360 },
} as const;

/** b 아치와 i 별이 들어간 워드마크. 헤더는 단일 아치, 대표 화면은 이중 아치입니다. */
export function BrandWordmark({
  variant = "header",
  height = 28,
  priority = false,
  alt = "LabBridge",
  className = "w-auto",
}: {
  variant?: "header" | "hero";
  height?: number;
  priority?: boolean;
  alt?: string;
  className?: string;
}) {
  const asset = WORDMARKS[variant];
  const width = Math.round((height * asset.width) / asset.height);
  return (
    <Image
      src={asset.src}
      alt={alt}
      width={width}
      height={height}
      priority={priority}
      className={className}
    />
  );
}

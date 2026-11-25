import Image from "next/image";

/** 팀이 고른 글래스 브릿지 심볼. 옆의 LabBridge 글자가 이름을 읽히므로 alt는 비웁니다. */
export function BrandMark({ size = 32, priority = false }: { size?: number; priority?: boolean }) {
  return (
    <Image
      src="/brand/labbridge-mark.png"
      alt=""
      width={size}
      height={size}
      priority={priority}
      className="rounded-[8px] shadow-[0_3px_10px_rgb(31_45_91_/_0.16)]"
    />
  );
}

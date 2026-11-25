import { kindLabel, type InsightKind } from "@/lib/insight-meta";

interface KindBadgeProps {
  kind: InsightKind;
}

/** 사례는 보라, 트렌드는 주황입니다. 색만으로 구분하지 않도록 이름도 같이 보여 줍니다. */
export function KindBadge({ kind }: KindBadgeProps) {
  const tone = kind === "case" ? "bg-brand" : "bg-trend";

  return <span className={`rounded-md px-2 py-1 text-[11px] font-semibold text-white ${tone}`}>{kindLabel(kind)}</span>;
}

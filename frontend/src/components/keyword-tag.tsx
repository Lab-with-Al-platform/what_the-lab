interface KeywordTagProps {
  label: string;
}

/** 글에 붙은 키워드입니다. 데이터에 #이 있어도 화면에서는 한 번만 보이게 합니다. */
export function KeywordTag({ label }: KeywordTagProps) {
  const text = label.replace(/^#/, "");

  return <span className="rounded-full bg-brand-soft px-3 py-1 text-xs font-medium text-brand">{text}</span>;
}

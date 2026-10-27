import type { Metadata } from "next";
import { Suspense } from "react";
import { ExpertSearch } from "@/components/expert-search";

export const metadata: Metadata = {
  title: "AI 전문가 찾기",
};

// 공개한 전문가를 DB에서 찾아 보여 줘요. (검색·필터는 화면 안에서 API로 다시 불러와요)
export default function ExpertsPage() {
  return <Suspense fallback={<p className="p-8 text-sm text-muted">전문가 검색을 준비하고 있어요…</p>}><ExpertSearch /></Suspense>;
}

import type { Metadata } from "next";
import { Suspense } from "react";
import { ExpertProfileRoute } from "@/components/routes/expert-profile-route";
import { placeholderParams } from "@/lib/static-route";

export const metadata: Metadata = { title: "AI 전문가" };

export function generateStaticParams() {
  return placeholderParams("slug");
}

// /experts/{전문가 번호}. 공개한 전문가의 프로필을 DB에서 불러와 보여 줘요.
export default function ExpertDetailPage() {
  return <Suspense fallback={<p className="p-8 text-sm text-muted">전문가 프로필을 불러오는 중…</p>}><ExpertProfileRoute /></Suspense>;
}

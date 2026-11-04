import type { Metadata } from "next";
import { Suspense } from "react";
import { ExpertProfileView } from "@/components/expert-profile-view";

export const metadata: Metadata = { title: "AI 전문가" };

type PageProps = { params: Promise<{ slug: string }> };

// /experts/{전문가 번호}. 공개한 전문가의 프로필을 DB에서 불러와 보여 줘요.
export default async function ExpertDetailPage({ params }: PageProps) {
  const { slug } = await params;
  return <Suspense fallback={<p className="p-8 text-sm text-muted">전문가 프로필을 불러오는 중…</p>}><ExpertProfileView expertId={slug} /></Suspense>;
}
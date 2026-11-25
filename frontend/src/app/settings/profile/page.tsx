import type { Metadata } from "next";
import { ProfileSettingsPage } from "@/components/profile-settings-page";

export const metadata: Metadata = { title: "프로필 설정" };

// 프로필 설정: 기본 정보(사진) · 소속 인증 정보(연구회원) / 가입 정보(전문가) · 알림
export default function Page() {
  return <ProfileSettingsPage />;
}
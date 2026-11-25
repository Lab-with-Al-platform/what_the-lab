import type { Metadata } from "next";
import { ResearcherSignupDone } from "@/components/researcher-signup-done";

export const metadata: Metadata = { title: "가입 완료" };

export default function ResearcherSignupDonePage() {
  return (
    <section className="bg-page px-4 py-16">
      <ResearcherSignupDone />
    </section>
  );
}
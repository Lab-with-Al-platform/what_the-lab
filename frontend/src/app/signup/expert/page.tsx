import type { Metadata } from "next";
import { ExpertSignupForm } from "@/components/expert-signup-form";

export const metadata: Metadata = { title: "AI 전문가 가입" };

export default function ExpertSignupPage() {
  return (
    <section className="mx-auto max-w-2xl px-4 py-16 md:px-6">
      <ExpertSignupForm />
    </section>
  );
}
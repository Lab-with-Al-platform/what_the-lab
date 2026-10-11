import type { Metadata } from "next";
import { ResearcherVerifyForm } from "@/components/researcher-verify-form";

export const metadata: Metadata = { title: "소속 인증" };

export default function ResearcherVerifyPage() {
  return (
    <section className="bg-page px-4 py-16">
      <div className="mx-auto max-w-[520px]">
        <ResearcherVerifyForm />
      </div>
    </section>
  );
}
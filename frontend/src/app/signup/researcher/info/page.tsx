import type { Metadata } from "next";
import { ResearcherInfoForm } from "@/components/researcher-info-form";

export const metadata: Metadata = { title: "기본 정보" };

export default function ResearcherInfoPage() {
  return (
    <section className="bg-page px-4 py-16">
      <div className="mx-auto max-w-[520px]">
        <ResearcherInfoForm />
      </div>
    </section>
  );
}
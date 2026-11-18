import { Suspense } from "react";
import { FaqPage } from "@/components/community/faq-page";
import { publicPageMetadata } from "@/lib/site-seo";

export const metadata = publicPageMetadata("/faq");
export default function FaqRoute() {
  return (
    <Suspense
      fallback={<p className="p-8 text-muted">도움말을 준비하고 있어요…</p>}
    >
      <FaqPage />
    </Suspense>
  );
}

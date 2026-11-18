import { publicPageMetadata } from "@/lib/site-seo";
import { HomePage } from "@/components/home-page";

export const metadata = publicPageMetadata("/");

export default function Page() {
  return <HomePage />;
}

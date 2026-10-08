import type { Metadata } from "next";
import { HomePage } from "@/components/home-page";

export const metadata: Metadata = {
  title: "연구의 질문이 AI와 만나는 곳",
};

export default function Page() {
  return <HomePage />;
}

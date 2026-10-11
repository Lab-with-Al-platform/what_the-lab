import type { Metadata } from "next";
import { SignupRoleForm } from "@/components/signup-role-form";

export const metadata: Metadata = { title: "회원가입" };

export default function SignupPage() {
  return (
    <section className="mx-auto max-w-2xl px-4 py-16 md:px-6">
      <SignupRoleForm />
    </section>
  );
}
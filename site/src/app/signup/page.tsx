import { AuthShell } from "@/components/AuthShell";
import { SignupForm } from "@/components/SignupForm";

export const metadata = { title: "Créer un compte — Omniscient" };

export default function SignupPage() {
  return (
    <AuthShell active="signup">
      <SignupForm />
    </AuthShell>
  );
}

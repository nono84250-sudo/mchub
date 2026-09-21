import { AuthShell } from "@/components/AuthShell";
import { LoginForm } from "@/components/LoginForm";

export const metadata = { title: "Connexion — Omniscient" };

export default function LoginPage() {
  return (
    <AuthShell active="login">
      <LoginForm />
    </AuthShell>
  );
}

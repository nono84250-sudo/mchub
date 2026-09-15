import { LoginForm } from "@/components/LoginForm";

export const metadata = { title: "Connexion — MCHub" };

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-2xl font-bold text-foreground mb-6">Connexion</h1>
      <LoginForm />
    </div>
  );
}

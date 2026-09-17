import { SignupForm } from "@/components/SignupForm";

export const metadata = { title: "Créer un compte — MCHub" };

export default function SignupPage() {
  return (
    <div className="mx-auto max-w-sm px-4 py-16 sm:py-24">
      <div className="panel p-6 sm:p-8">
        <h1 className="text-2xl font-bold text-foreground mb-6">Créer un compte</h1>
        <SignupForm />
      </div>
    </div>
  );
}

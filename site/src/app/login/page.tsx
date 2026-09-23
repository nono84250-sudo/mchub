import { AuthShell } from "@/components/AuthShell";
import { MicrosoftSignInButton } from "@/components/MicrosoftSignInButton";
import { getT } from "@/i18n/getDictionary";

export const metadata = { title: "Connexion — Omniscient" };

export default async function LoginPage() {
  const { dict } = await getT();

  return (
    <AuthShell>
      <div className="flex flex-col gap-1.5">
        <h1 className="text-xl font-heading text-foreground">{dict.auth.signInTitle}</h1>
        <p className="text-sm text-muted">{dict.auth.signInHelp}</p>
      </div>
      <MicrosoftSignInButton />
    </AuthShell>
  );
}

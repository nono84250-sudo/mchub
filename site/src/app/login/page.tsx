import { auth } from "@/auth";
import { AuthShell } from "@/components/AuthShell";
import { MicrosoftSignInButton } from "@/components/MicrosoftSignInButton";
import { getT } from "@/i18n/getDictionary";

export const metadata = { title: "Connexion — Omniscient" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { dict } = await getT();
  // Microsoft a repondu mais la chaine Xbox -> Minecraft a echoue (voir auth.ts) :
  // sans ce message, la personne se retrouve ici sans comprendre pourquoi.
  const session = await auth();
  const error =
    session?.error === "pending_approval"
      ? dict.auth.signInErrorPending
      : session?.error
        ? dict.auth.signInErrorProfile
        : null;

  // 2026-10-10 : proxy.ts pose deja ?from=/dashboard/xxx quand une page protegee redirige
  // ici — jamais lu auparavant, la connexion renvoyait donc toujours vers /dashboard tout
  // court, meme en arrivant depuis une sous-page. Validation basique faite dans
  // signInWithMicrosoft (doit commencer par "/", jamais une URL externe) : on se contente
  // de lire la query ici.
  const params = await searchParams;
  const from = typeof params.from === "string" ? params.from : undefined;

  return (
    <AuthShell>
      <div className="flex flex-col gap-1.5">
        <h1 className="text-xl font-heading text-foreground">{dict.auth.signInTitle}</h1>
        <p className="text-sm text-muted">{dict.auth.signInHelp}</p>
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      )}
      <MicrosoftSignInButton from={from} />
    </AuthShell>
  );
}

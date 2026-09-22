import Link from "next/link";
import { getT } from "@/i18n/getDictionary";

// Mise en page a deux panneaux partagee par /login et /signup (maquette
// "Nocturne" ecran 01) : un panneau hero a gauche, le formulaire a droite
// avec un bascule Connexion/Creer un compte au-dessus. Les deux pages
// restent des routes/actions distinctes — seule l'habillage est partage.
export async function AuthShell({ active, children }: { active: "login" | "signup"; children: React.ReactNode }) {
  const { dict } = await getT();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] min-h-[calc(100vh-64px)]">
      <div
        className="relative hidden lg:flex flex-col justify-between overflow-hidden p-14"
        style={{ backgroundImage: "linear-gradient(160deg, var(--accent-fill), var(--background) 70%)" }}
      >
        <div
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "repeating-linear-gradient(135deg, color-mix(in srgb, var(--accent) 8%, transparent) 0 2px, transparent 2px 14px)",
          }}
        />
        <div className="relative z-10 max-w-md flex flex-col gap-3 mt-auto">
          <h2 className="text-3xl font-heading text-foreground">{dict.auth.heroTitle}</h2>
          <p className="text-sm text-muted">{dict.auth.heroBody}</p>
        </div>
      </div>

      <div className="flex flex-col justify-center px-6 py-16 sm:px-16">
        <div className="w-full max-w-sm mx-auto flex flex-col gap-6">
          <div className="inline-flex border border-border rounded-md overflow-hidden w-fit">
            <Link
              href="/login"
              className="px-4 py-2 text-sm whitespace-nowrap"
              style={
                active === "login"
                  ? { boxShadow: "inset 0 0 0 1px var(--accent)", color: "var(--accent)" }
                  : { color: "var(--muted)" }
              }
            >
              {dict.auth.tabLogin}
            </Link>
            <Link
              href="/signup"
              className="px-4 py-2 text-sm whitespace-nowrap border-l border-border"
              style={
                active === "signup"
                  ? { boxShadow: "inset 0 0 0 1px var(--accent)", color: "var(--accent)" }
                  : { color: "var(--muted)" }
              }
            >
              {dict.auth.tabSignup}
            </Link>
          </div>

          {children}
        </div>
      </div>
    </div>
  );
}

import { getT } from "@/i18n/getDictionary";

// Mise en page a deux panneaux (maquette "Nocturne" ecran 01) : un panneau
// hero a gauche, le contenu de connexion a droite. Plus de bascule Connexion/
// Creer un compte depuis le passage a "Se connecter avec Microsoft" (voir
// auth.ts) — une seule action, qui cree le compte au besoin.
export async function AuthShell({ children }: { children: React.ReactNode }) {
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
        <div className="w-full max-w-sm mx-auto flex flex-col gap-6">{children}</div>
      </div>
    </div>
  );
}

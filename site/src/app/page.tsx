import Link from "next/link";

const FEATURES = [
  {
    title: "Annuaire public",
    description: "Chaque serveur a sa fiche : description, modpack, statut des joueurs en direct.",
  },
  {
    title: "Connexion Microsoft/Xbox",
    description: "Les joueurs se connectent avec leur vrai compte Minecraft, directement dans le launcher.",
  },
  {
    title: "Modpacks CurseForge",
    description: "Lie ton modpack vérifié pour que les joueurs rejoignent sans configuration manuelle.",
  },
];

export default function Home() {
  return (
    <div className="relative overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[560px]"
        style={{
          backgroundImage:
            "radial-gradient(60% 50% at 30% 0%, rgba(124,92,255,0.28), transparent 70%), radial-gradient(50% 40% at 80% 10%, rgba(34,211,238,0.20), transparent 70%)",
        }}
      />

      <div className="mx-auto max-w-4xl px-4 sm:px-6 py-24 sm:py-32 text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs text-muted">
          <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden="true" />
          Accès Minecraft/Xbox approuvé — le launcher est en ligne
        </span>

        <h1 className="mt-6 text-4xl sm:text-6xl font-bold tracking-tight text-foreground text-balance">
          La boîte à outils des serveurs <span className="gradient-text">Minecraft</span>
        </h1>
        <p className="mt-5 text-lg text-muted max-w-2xl mx-auto text-balance">
          Publie ton serveur, lie ton modpack vérifié par CurseForge, et laisse tes joueurs
          te rejoindre en un clic grâce au launcher MCHub.
        </p>
        <div className="mt-9 flex items-center justify-center gap-4">
          <Link href="/servers" className="btn-primary">
            Découvrir les serveurs
          </Link>
          <Link href="/signup" className="btn-secondary">
            Publier mon serveur
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 sm:px-6 pb-24">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {FEATURES.map((feature) => (
            <div key={feature.title} className="panel glow-card p-5">
              <h3 className="font-semibold text-foreground">{feature.title}</h3>
              <p className="mt-2 text-sm text-muted">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

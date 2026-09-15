import Link from "next/link";

export default function Home() {
  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 py-24 text-center">
      <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground">
        La boîte à outils des serveurs <span className="text-accent">Minecraft</span>
      </h1>
      <p className="mt-4 text-lg text-muted max-w-2xl mx-auto">
        Publie ton serveur, lie ton modpack vérifié par CurseForge, et laisse tes joueurs
        te rejoindre en un clic grâce au launcher MCHub.
      </p>
      <div className="mt-8 flex items-center justify-center gap-4">
        <Link
          href="/servers"
          className="rounded-md bg-accent px-5 py-2.5 font-medium text-accent-foreground hover:bg-accent-hover transition-colors"
        >
          Découvrir les serveurs
        </Link>
        <Link
          href="/signup"
          className="rounded-md border border-border px-5 py-2.5 font-medium text-foreground hover:border-accent transition-colors"
        >
          Publier mon serveur
        </Link>
      </div>
    </div>
  );
}

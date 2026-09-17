import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-border mt-16">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted">
        <p>
          <span className="text-foreground font-medium">Omniscient</span> — la boîte à outils des serveurs
          Minecraft.
        </p>
        <div className="flex items-center gap-5">
          <Link href="/servers" className="hover:text-foreground transition-colors">
            Serveurs
          </Link>
          <Link href="/signup" className="hover:text-foreground transition-colors">
            Publier un serveur
          </Link>
        </div>
      </div>
    </footer>
  );
}

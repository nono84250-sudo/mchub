import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { DownloadSimple } from "@phosphor-icons/react/ssr";
import { auth } from "@/auth";
import { LogoMark } from "@/components/LogoMark";
import { MobileNav } from "@/components/MobileNav";
import { AccountMenu } from "@/components/AccountMenu";
import { getT } from "@/i18n/getDictionary";
import { countUnreadNotifications } from "@/lib/unreadNotifications";

export async function Nav() {
  // Idee 1 du lancement (19/10) : la barre du haut est sur toutes les pages. Si la base ne
  // repond pas (session ou pastille des non-lus), elle s'affiche quand meme, comme pour un
  // visiteur sans compte, au lieu de faire tomber la page entiere (pages legales comprises).
  const session = await auth().catch((error: unknown) => {
    unstable_rethrow(error);
    return null;
  });
  const { dict } = await getT();
  const unread = session?.user?.id
    ? await countUnreadNotifications(session.user.id).catch((error: unknown) => {
        unstable_rethrow(error);
        return 0;
      })
    : 0;

  return (
    <header className="relative border-b border-border bg-surface/95 backdrop-blur-md sticky top-0 z-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <Link href="/" className="font-heading flex items-center gap-2.5 font-semibold text-lg tracking-tight text-foreground">
            <LogoMark className="h-4 w-4" />
            Omniscient
          </Link>

          {/* Liens de nav principaux, colles au logo (Telecharger retire le 17/10 : doublon du
              bouton plein a droite ; il reste dans le menu mobile et le pied de page) — les prochains viendront
              s'ajouter ici, de gauche a droite. */}
          <nav className="hidden sm:flex items-center gap-4 text-sm">
            <Link href="/servers" className="text-muted hover:text-foreground transition-colors">
              {dict.nav.servers}
            </Link>
            <Link href="/contact" className="text-muted hover:text-foreground transition-colors">
              {dict.nav.contact}
            </Link>
          </nav>
        </div>

        <MobileNav loggedIn={!!session?.user?.id} unread={unread} />

        {/* Elements utilitaires, toujours a droite. Langue/Apparence vivent
            dans le pied de page (Footer.tsx), pas ici — connecte, elles
            restent aussi accessibles depuis "Mon espace" (AccountMenu.tsx). */}
        <div className="hidden sm:flex items-center gap-4 text-sm">
          {/* Design 2026-10-17, point 1 : Telecharger devient le bouton fort,
              Se connecter passe en simple lien (un joueur n'a pas besoin de
              compte pour jouer). */}
          {session?.user?.id ? (
            <AccountMenu unread={unread} />
          ) : (
            <Link href="/login" className="text-muted hover:text-foreground transition-colors">
              {dict.nav.login}
            </Link>
          )}
          <Link href="/download" className="btn-fill text-sm py-1.5 px-3">
            <DownloadSimple className="h-4 w-4" />
            {dict.nav.download}
          </Link>
        </div>
      </div>
    </header>
  );
}

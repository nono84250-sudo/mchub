import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { logout } from "@/lib/actions/auth";
import { SignOut } from "@phosphor-icons/react/ssr";
import { getT } from "@/i18n/getDictionary";
import { DeleteAccountSection } from "@/components/DeleteAccountSection";
import { ExportDataSection } from "@/components/ExportDataSection";
import { FriendPrivacyCard } from "@/components/FriendPrivacyCard";
import { FRIEND_PRIVACY_READY, getFriendSettings } from "@/lib/friendPrivacy";
import { featureVisibleOnSite } from "@/lib/features";

export const metadata = { title: "Paramètres — Omniscient" };

// Anciennement /account (page isolee, hors nav) : deplacee ici le 2026-10-13 pour rejoindre
// les autres onglets du dashboard (Serveurs/Notifications/Actualites), comme "Parametres"
// cote admin et cote gestion de serveur — meme convention partout plutot qu'une page a part.
// Toujours rien a editer ici depuis le passage a "Se connecter avec Microsoft" (voir auth.ts) :
// le pseudo vient du profil Minecraft/Xbox, resynchronise a chaque connexion.
export default async function ParametresPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await db.orm.public.User.select("id", "name", "minecraftUsername").where({ id: session.user.id }).first();
  if (!user) redirect("/login");
  const { dict } = await getT();
  const friendSettings = FRIEND_PRIVACY_READY && (await featureVisibleOnSite("friends")) ? await getFriendSettings(user.id) : null;

  const initial = user.name.trim().charAt(0).toUpperCase() || "?";

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-foreground">{dict.account.title}</h1>

      <div className="panel mt-8 p-6">
        <div className="flex items-center gap-4">
          <span className="server-icon h-16 w-16 rounded-full text-2xl">{initial}</span>
          <div>
            <p className="font-medium text-foreground">{user.name}</p>
            <p className="text-sm text-muted">{dict.account.microsoftLinked}</p>
          </div>
        </div>

        <form action={logout} className="mt-6">
          <button type="submit" className="flex items-center gap-2 text-sm text-muted hover:text-foreground">
            <SignOut className="h-4 w-4" />
            {dict.account.logout}
          </button>
        </form>

        {/* Confidentialite (variante C, 18/10) : meme reglage que la page Amis. */}
        {friendSettings ? (
          <section className="mt-8 border-t border-border pt-6">
            <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.07em] text-accent">{dict.friends.privacySection}</h2>
            <FriendPrivacyCard initialPolicy={friendSettings.friendPolicy} initialCode={friendSettings.friendCode} alsoOnFriends />
          </section>
        ) : null}
        {/* « Recuperer mes donnees » (23/10) : juste avant la suppression du compte. */}
        <ExportDataSection />
        <DeleteAccountSection />
      </div>
    </div>
  );
}

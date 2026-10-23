import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getT } from "@/i18n/getDictionary";
import { listFriendsOverview } from "@/lib/friends";
import { FriendsPanel } from "@/components/FriendsPanel";
import { FriendsHeader } from "@/components/FriendsHeader";
import { FRIEND_PRIVACY_READY, getFriendSettings } from "@/lib/friendPrivacy";

export const dynamic = "force-dynamic";
export const metadata = { title: "Amis — Omniscient" };

// Systeme d'amis (2026-10-14) : statut binaire en ligne/hors ligne visible des seuls amis
// acceptes (lib/presence.ts), demande puis accord (lib/friends.ts), accessible depuis le menu
// "Mon espace" (AccountMenu.tsx) ET depuis la nav du dashboard (DashboardNav.tsx).
export default async function AmisPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const { dict } = await getT();

  const [{ friends, incoming, outgoing }, settings] = await Promise.all([
    listFriendsOverview(session.user.id),
    FRIEND_PRIVACY_READY ? getFriendSettings(session.user.id) : Promise.resolve(null),
  ]);

  return (
    <div>
      {/* Reglage « Qui peut m'ajouter » derriere l'engrenage (valide par Rushi le 18/10). */}
      {settings ? (
        <FriendsHeader title={dict.friends.title} policy={settings.friendPolicy} code={settings.friendCode} />
      ) : (
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{dict.friends.title}</h1>
      )}
      <div className="panel mt-6 p-6">
        <FriendsPanel
          friends={friends}
          incoming={incoming}
          outgoing={outgoing}
          myCode={settings?.friendPolicy === "code" ? settings.friendCode : null}
        />
      </div>
    </div>
  );
}

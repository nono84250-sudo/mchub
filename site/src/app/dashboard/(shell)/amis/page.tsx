import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getT } from "@/i18n/getDictionary";
import { listFriends } from "@/lib/friends";
import { FriendsPanel } from "@/components/FriendsPanel";

export const dynamic = "force-dynamic";
export const metadata = { title: "Amis — Omniscient" };

// Systeme d'amis, phase 1 (2026-10-14, voir le rapport) : statut binaire en ligne/hors ligne
// (lib/presence.ts), ajout direct et reciproque (lib/friends.ts), accessible depuis le menu
// "Mon espace" (AccountMenu.tsx) ET depuis la nav du dashboard (DashboardNav.tsx).
export default async function AmisPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const { dict } = await getT();

  const friends = await listFriends(session.user.id);

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-foreground">{dict.friends.title}</h1>
      <div className="panel mt-8 p-6">
        <FriendsPanel friends={friends} />
      </div>
    </div>
  );
}

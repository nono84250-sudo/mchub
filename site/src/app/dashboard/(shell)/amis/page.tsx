import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getT } from "@/i18n/getDictionary";
import { listFriendsOverview } from "@/lib/friends";
import { FriendsPanel } from "@/components/FriendsPanel";

export const dynamic = "force-dynamic";
export const metadata = { title: "Amis — Omniscient" };

// Systeme d'amis (2026-10-14) : statut binaire en ligne/hors ligne visible des seuls amis
// acceptes (lib/presence.ts), demande puis accord (lib/friends.ts), accessible depuis le menu
// "Mon espace" (AccountMenu.tsx) ET depuis la nav du dashboard (DashboardNav.tsx).
export default async function AmisPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const { dict } = await getT();

  const { friends, incoming, outgoing } = await listFriendsOverview(session.user.id);

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-foreground">{dict.friends.title}</h1>
      <div className="panel mt-8 p-6">
        <FriendsPanel friends={friends} incoming={incoming} outgoing={outgoing} />
      </div>
    </div>
  );
}

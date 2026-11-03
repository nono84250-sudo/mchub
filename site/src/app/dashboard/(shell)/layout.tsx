import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { DashboardNav } from "@/components/DashboardNav";
import { countUnreadNotifications } from "@/lib/unreadNotifications";
import { featuresFor, siteViewer } from "@/lib/features";

export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  // Laboratoire (25/10) : seuls les onglets visibles pour ce compte apparaissent.
  const [unread, features] = await Promise.all([countUnreadNotifications(session.user.id), featuresFor(await siteViewer())]);

  return (
    <div className="mx-auto flex max-w-6xl gap-8 px-4 sm:px-6 py-12">
      <DashboardNav
        unread={unread}
        playBeta={features.worlds.visible ? features.worlds.beta || !!features.cloudPacks?.beta : !!features.cloudPacks?.beta}
        show={{
          friends: features.friends.visible,
          team: features.team.visible,
          // Menu « Cloud » (03/11) : modpacks du cloud ou mondes en ligne.
          worlds: features.worlds.visible || !!features.cloudPacks?.visible,
          packs: features.omniPack?.visible ?? false,
        }}
      />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

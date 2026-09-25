import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { createServer } from "@/lib/actions/servers";
import { getMinecraftVersions } from "@/lib/minecraft-versions";
import { NewServerWizard } from "@/components/NewServerWizard";

export const metadata = { title: "Nouveau serveur — Omniscient" };

// Hors du groupe (shell) de /dashboard : pas de barre laterale du tableau de
// bord autour, l'assistant prend toute la page (voir SiteChrome et
// NewServerWizard). L'authentification est donc verifiee ici, plus dans le
// layout du tableau de bord.
export default async function NewServerPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const versions = await getMinecraftVersions();

  return <NewServerWizard action={createServer} versions={versions} />;
}

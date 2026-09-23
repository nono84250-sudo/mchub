import { notFound, redirect } from "next/navigation";
import { getSlugByInviteCode } from "@/lib/public-servers";

// Destination du lien/code d'invitation affiche dans les reglages d'un
// serveur prive (voir ServerForm.tsx) — un simple redirect vers la fiche
// publique habituelle : le code ne fait que prouver qu'on a le droit de
// voir une fiche que l'annuaire ne liste jamais (voir listPublicServers).
export default async function JoinByInviteCodePage({ params }: PageProps<"/join/[code]">) {
  const { code } = await params;
  const slug = await getSlugByInviteCode(code.toUpperCase());
  if (!slug) notFound();
  redirect(`/servers/${slug}`);
}

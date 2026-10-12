import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { DesignScreen } from "@/components/admin/DesignScreen";
import { requireAdmin } from "@/app/admin/design/guard";
import { transferPageHtml } from "@/app/admin/design/bind";

export const dynamic = "force-dynamic";

// Recherche de joueurs (même filtre nom/UUID que admin/(panel)/players/page.tsx), en mémoire :
// le nombre de comptes reste modeste, pas besoin d'une requête SQL dédiée.
export default async function ServerTransfer({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireAdmin();
  const { slug } = await params;
  const query = await searchParams;
  const server = await db.orm.public.Server.select("id", "slug", "name", "ownerId")
    .include("owner", (o) => o.select("name"))
    .where({ slug })
    .first();
  if (!server) notFound();

  const q = (query.q ?? "").trim().slice(0, 100);
  const targetId = query.targetId ?? "";

  let candidates: { id: string; name: string; minecraftUuid: string | null }[] = [];
  let target: { id: string; name: string } | null = null;
  if (targetId) {
    const player = await db.orm.public.User.select("id", "name").where({ id: targetId }).first();
    if (player && player.id !== server.ownerId) target = player;
  } else if (q) {
    const needle = q.toLowerCase();
    const players = await db.orm.public.User.select("id", "name", "minecraftUuid").all();
    candidates = players
      .filter((p) => p.name.toLowerCase().includes(needle) || (p.minecraftUuid ?? "").toLowerCase().includes(needle))
      .slice(0, 10);
  }

  const html = transferPageHtml({
    id: server.id,
    slug: server.slug,
    name: server.name,
    ownerId: server.ownerId,
    ownerName: server.owner?.name ?? "—",
    q,
    candidates,
    target,
  });
  return <DesignScreen name="servers" html={html} />;
}

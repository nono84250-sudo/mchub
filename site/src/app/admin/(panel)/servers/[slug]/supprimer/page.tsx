import { notFound } from "next/navigation";
import { db } from "@/prisma/db";
import { DesignScreen } from "@/components/admin/DesignScreen";
import { requireAdmin } from "@/app/admin/design/guard";
import { deletePageHtml } from "@/app/admin/design/bind";

export const dynamic = "force-dynamic";

// Page de confirmation de la suppression : il faut retaper le nom du serveur.
export default async function ServerDelete({ params }: { params: Promise<{ slug: string }> }) {
  await requireAdmin();
  const { slug } = await params;
  const server = await db.orm.public.Server.select("id", "slug", "name").where({ slug }).first();
  if (!server) notFound();
  return <DesignScreen name="servers" html={deletePageHtml(server)} />;
}

import { notFound } from "next/navigation";
import { db } from "@/prisma/db";
import { DesignScreen } from "@/components/admin/DesignScreen";
import { requireAdmin } from "@/app/admin/design/guard";
import { freezePageHtml } from "@/app/admin/design/bind";

export const dynamic = "force-dynamic";

// Page de confirmation du gel (maquette A06b), à la place d'une fenêtre.
export default async function ServerFreeze({ params }: { params: Promise<{ slug: string }> }) {
  await requireAdmin();
  const { slug } = await params;
  const server = await db.orm.public.Server.select("id", "slug", "name").where({ slug }).first();
  if (!server) notFound();
  return <DesignScreen name="servers" html={freezePageHtml(server)} />;
}

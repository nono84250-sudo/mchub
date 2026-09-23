import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/prisma/db";
import { ManageSidebar } from "@/components/ManageSidebar";
import { ManageAvatarMenu } from "@/components/ManageAvatarMenu";

// Console de gestion d'un serveur : prend toute la page (voir SiteChrome,
// qui retire la nav/footer du site sur ces routes), avec sa propre barre
// laterale et son propre menu de compte en haut a droite — inspire de ce
// que font la plupart des back-offices.
export default async function ManageServerLayout({ children, params }: LayoutProps<"/manage/[id]">) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const server = await db.orm.public.Server.select("id", "name").where({ id, ownerId: session.user.id }).first();
  if (!server) notFound();

  return (
    <div className="flex min-h-screen">
      <ManageSidebar serverId={server.id} serverName={server.name} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-end border-b border-border px-6 py-3">
          <ManageAvatarMenu name={session.user.name ?? ""} />
        </header>
        <main className="flex-1 px-6 py-8 sm:px-10">{children}</main>
      </div>
    </div>
  );
}

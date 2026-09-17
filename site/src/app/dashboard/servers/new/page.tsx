import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { createServer } from "@/lib/actions/servers";
import { getMinecraftVersions } from "@/lib/minecraft-versions";
import { ServerForm } from "@/components/ServerForm";

export const metadata = { title: "Nouveau serveur — Omniscient" };

export default async function NewServerPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const versions = await getMinecraftVersions();

  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 py-12">
      <h1 className="text-2xl font-bold text-foreground mb-6">Publier un nouveau serveur</h1>
      <div className="panel p-6 sm:p-8">
        <ServerForm action={createServer} submitLabel="Publier le serveur" versions={versions} />
      </div>
    </div>
  );
}

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { createServer } from "@/lib/actions/servers";
import { getMinecraftVersions } from "@/lib/minecraft-versions";
import { NewServerWizard } from "@/components/NewServerWizard";

export const metadata = { title: "Nouveau serveur — Omniscient" };

export default async function NewServerPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const versions = await getMinecraftVersions();

  return (
    <div className="max-w-2xl">
      <div className="panel p-6 sm:p-10">
        <NewServerWizard action={createServer} versions={versions} />
      </div>
    </div>
  );
}

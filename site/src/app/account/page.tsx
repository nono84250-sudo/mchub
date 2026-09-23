import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/prisma/db";
import { logout } from "@/lib/actions/auth";
import { SignOut } from "@phosphor-icons/react/ssr";
import { getT } from "@/i18n/getDictionary";

export const metadata = { title: "Profil — Omniscient" };

// Plus rien a editer ici depuis le passage a "Se connecter avec Microsoft"
// (voir auth.ts) : le pseudo vient du profil Minecraft/Xbox, resynchronise
// a chaque connexion — il n'y a plus d'email ni de mot de passe a gerer.
export default async function AccountPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await db.orm.public.User.select("id", "name", "minecraftUsername")
    .where({ id: session.user.id })
    .first();
  if (!user) redirect("/login");
  const { dict } = await getT();

  const initial = user.name.trim().charAt(0).toUpperCase() || "?";

  return (
    <div className="mx-auto max-w-md px-4 py-16 sm:py-20">
      <h1 className="text-2xl font-bold text-foreground mb-7">{dict.account.title}</h1>

      <div className="flex items-center gap-4 mb-7">
        <span className="server-icon h-16 w-16 rounded-full text-2xl">{initial}</span>
        <div>
          <p className="font-medium text-foreground">{user.name}</p>
          <p className="text-sm text-muted">{dict.account.microsoftLinked}</p>
        </div>
      </div>

      <form action={logout}>
        <button type="submit" className="flex items-center gap-2 text-sm text-muted hover:text-foreground">
          <SignOut className="h-4 w-4" />
          {dict.account.logout}
        </button>
      </form>
    </div>
  );
}

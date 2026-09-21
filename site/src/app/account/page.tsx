import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/prisma/db";
import { logout } from "@/lib/actions/auth";
import { AccountForm } from "@/components/AccountForm";
import { LogOut } from "lucide-react";

export const metadata = { title: "Profil — Omniscient" };

export default async function AccountPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await db.orm.public.User.select("id", "name", "email").where({ id: session.user.id }).first();
  if (!user) redirect("/login");

  const initial = user.name.trim().charAt(0).toUpperCase() || "?";

  return (
    <div className="mx-auto max-w-md px-4 py-16 sm:py-20">
      <h1 className="text-2xl font-bold text-foreground mb-7">Compte</h1>

      <div className="flex items-center gap-4 mb-7">
        <span className="server-icon h-16 w-16 rounded-full text-2xl">{initial}</span>
        <div>
          <p className="font-medium text-foreground">{user.name}</p>
          <p className="text-sm text-muted">{user.email}</p>
        </div>
      </div>

      <AccountForm name={user.name} email={user.email} />

      <div className="divider-fade my-6" />

      <form action={logout}>
        <button type="submit" className="flex items-center gap-2 text-sm text-muted hover:text-foreground">
          <LogOut className="h-4 w-4" />
          Se déconnecter
        </button>
      </form>
    </div>
  );
}

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { DashboardNav } from "@/components/DashboardNav";

export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  return (
    <div className="mx-auto flex max-w-6xl gap-8 px-4 sm:px-6 py-12">
      <DashboardNav />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

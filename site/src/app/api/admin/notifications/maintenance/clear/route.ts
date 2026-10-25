import { NextResponse } from "next/server";
import { adminForAction } from "@/lib/adminServers";
import { clearLauncherMaintenance, getSiteBanner, setSiteBanner } from "@/lib/platformSettings";

// Termine (ou annule, si elle n'a pas encore commence) la maintenance. Retire aussi la banniere
// du site si c'est une banniere de maintenance : elle annoncait cette maintenance-la.
export async function POST(request: Request) {
  const admin = await adminForAction(request);
  if (admin instanceof NextResponse) return admin;
  await clearLauncherMaintenance();
  const banner = await getSiteBanner();
  if (banner?.type === "maintenance") await setSiteBanner(null);
  return NextResponse.redirect(new URL("/admin/notifications", request.url), 303);
}

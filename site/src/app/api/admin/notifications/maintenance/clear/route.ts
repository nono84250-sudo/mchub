import { NextResponse } from "next/server";
import { adminForAction } from "@/lib/adminServers";
import { clearLauncherMaintenance } from "@/lib/platformSettings";

export async function POST(request: Request) {
  const admin = await adminForAction(request);
  if (admin instanceof NextResponse) return admin;
  await clearLauncherMaintenance();
  return NextResponse.redirect(new URL("/admin/notifications", request.url), 303);
}

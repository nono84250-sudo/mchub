import { NextResponse } from "next/server";
import { adminForAction } from "@/lib/adminServers";
import { activateLauncherMaintenance } from "@/lib/platformSettings";

export async function POST(request: Request) {
  const admin = await adminForAction(request);
  if (admin instanceof NextResponse) return admin;
  const form = await request.formData();
  const message = String(form.get("message") ?? "").trim().slice(0, 500);
  if (message.length < 3) return NextResponse.json({ error: "Écrivez un message (3 caractères minimum)." }, { status: 400 });
  await activateLauncherMaintenance(message);
  return NextResponse.redirect(new URL("/admin/notifications", request.url), 303);
}

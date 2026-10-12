import { NextResponse } from "next/server";
import { adminForAction } from "@/lib/adminServers";
import { activateLauncherMaintenance } from "@/lib/platformSettings";
import { rateLimitResponse } from "@/lib/rateLimit";

export async function POST(request: Request) {
  const limited = rateLimitResponse(request, "admin-maintenance-activate", 10);
  if (limited) return limited;
  const admin = await adminForAction(request);
  if (admin instanceof NextResponse) return admin;
  const form = await request.formData();
  const message = String(form.get("message") ?? "").trim().slice(0, 500);
  if (message.length < 3) return NextResponse.json({ error: "Écrivez un message (3 caractères minimum)." }, { status: 400 });
  await activateLauncherMaintenance(message);
  return NextResponse.redirect(new URL("/admin/notifications", request.url), 303);
}

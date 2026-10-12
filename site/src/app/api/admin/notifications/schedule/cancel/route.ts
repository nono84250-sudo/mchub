import { NextResponse } from "next/server";
import { adminForAction } from "@/lib/adminServers";
import { cancelScheduledBroadcast } from "@/lib/scheduledBroadcasts";

export async function POST(request: Request) {
  const admin = await adminForAction(request);
  if (admin instanceof NextResponse) return admin;
  const form = await request.formData();
  const id = String(form.get("id") ?? "");
  if (id) await cancelScheduledBroadcast(id);
  return NextResponse.redirect(new URL("/admin/notifications", request.url), 303);
}

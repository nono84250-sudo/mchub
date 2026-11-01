import { NextResponse } from "next/server";
import { adminForAction, backToServers } from "@/lib/adminServers";
import { refuseTagGroup } from "@/lib/tagRequests";
import { TAG_REFUSE_REASONS } from "@/lib/tagCatalog";

// Refuse un mot propose (page /admin/etiquettes), avec un des 4 motifs montres au proprietaire.
export async function POST(request: Request) {
  const admin = await adminForAction(request);
  if (admin instanceof NextResponse) return admin;
  const form = await request.formData();
  const normalized = String(form.get("normalized") ?? "").trim();
  const reason = Number(form.get("reason"));
  if (!normalized || !Number.isInteger(reason) || reason < 0 || reason >= TAG_REFUSE_REASONS) {
    return backToServers(request, "/admin/etiquettes?error=generic");
  }
  try {
    await refuseTagGroup(normalized, reason);
  } catch (err) {
    console.error("[tagRequests] refus impossible :", err);
    return backToServers(request, "/admin/etiquettes?error=generic");
  }
  return backToServers(request, "/admin/etiquettes?done=refused");
}

import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { getCurrentAdmin, type CurrentAdmin } from "@/lib/adminSession";
import { SERVERS_CACHE_TAG } from "@/lib/public-servers";

// Actions du menu « ... » de la liste des serveurs (panel admin). Réservées aux
// administrateurs, comme les interrupteurs de sources. Les formulaires viennent
// de la même origine : le cookie admin est strict, et on refuse une origine étrangère.
export async function adminForAction(request: Request): Promise<CurrentAdmin | NextResponse> {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return NextResponse.json({ error: "Origine refusée." }, { status: 403 });
  }
  const admin = await getCurrentAdmin();
  if (!admin || admin.mustChangeCredentials) return NextResponse.json({ error: "Connexion requise." }, { status: 401 });
  if (admin.role !== "admin") return NextResponse.json({ error: "Action réservée aux administrateurs." }, { status: 403 });
  return admin;
}

// Le cache de l'annuaire et de l'API du launcher est vidé tout de suite.
export function refreshServersCache() {
  revalidateTag(SERVERS_CACHE_TAG, { expire: 0 });
}

export function backToServers(request: Request, path = "/admin/servers") {
  return NextResponse.redirect(new URL(path, request.url), 303);
}

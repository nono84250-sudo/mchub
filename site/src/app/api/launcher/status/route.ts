import { NextResponse } from "next/server";
import { isAuthorizedLauncherRequest } from "@/lib/launcherAuth";
import { getStatusSnapshot } from "@/lib/status-snapshot";

// Résultat partagé des tests de serveurs (voir status-snapshot.ts). Réservé au launcher.
export async function GET(request: Request) {
  if (!isAuthorizedLauncherRequest(request)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  return NextResponse.json(await getStatusSnapshot());
}

import { NextResponse } from "next/server";
import { isAuthorizedLauncherRequest } from "@/lib/launcherAuth";
import { getStatusSnapshot } from "@/lib/status-snapshot";
import { withD1Busy } from "@/lib/d1Busy";

// Résultat partagé des tests de serveurs (voir status-snapshot.ts). Réservé au launcher.
async function handleGET(request: Request) {
  if (!isAuthorizedLauncherRequest(request)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  return NextResponse.json(await getStatusSnapshot());
}

export const GET = withD1Busy(handleGET);

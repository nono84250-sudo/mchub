import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { getCurrentAdmin, type CurrentAdmin } from "@/lib/adminSession";
import { SERVERS_CACHE_TAG } from "@/lib/public-servers";

// Actions du menu « ... » de la liste des serveurs (panel admin). Réservées aux
// administrateurs, comme les interrupteurs de sources. Les formulaires viennent
// de la même origine : le cookie admin est strict, et on refuse une origine étrangère.
//
// `allowMustChangeCredentials` : permet d'appeler cette garde depuis la route de changement
// d'identifiants elle-même (voir api/admin/credentials/route.ts), seule action qu'un compte
// avec mustChangeCredentials=true doit encore pouvoir faire (sinon il ne pourrait jamais sortir
// de cet état). `requireAdminRole` (true par défaut) : certaines actions (changer SES PROPRES
// identifiants) ne sont pas réservées aux admins, contrairement au reste des 30+ routes d'écriture.
export async function adminForAction(
  request: Request,
  options: { allowMustChangeCredentials?: boolean; requireAdminRole?: boolean } = {},
): Promise<CurrentAdmin | NextResponse> {
  const origin = request.headers.get("origin");
  // Fail-closed (audit §1.11) : une requête d'écriture SANS en-tête Origin est refusée comme une
  // origine différente, pas laissée passer. Les navigateurs posent toujours Origin sur une
  // requête POST (fetch ou formulaire HTML), même pour une requête same-origin, précisément pour
  // permettre ce genre de contrôle anti-CSRF — son absence est donc elle-même suspecte.
  if (!origin || origin !== new URL(request.url).origin) {
    return NextResponse.json({ error: "Origine refusée." }, { status: 403 });
  }
  const admin = await getCurrentAdmin();
  if (!admin || (admin.mustChangeCredentials && !options.allowMustChangeCredentials)) {
    return NextResponse.json({ error: "Connexion requise." }, { status: 401 });
  }
  if ((options.requireAdminRole ?? true) && admin.role !== "admin") {
    return NextResponse.json({ error: "Action réservée aux administrateurs." }, { status: 403 });
  }
  return admin;
}

// Le cache de l'annuaire et de l'API du launcher est vidé tout de suite.
export function refreshServersCache() {
  revalidateTag(SERVERS_CACHE_TAG, { expire: 0 });
}

export function backToServers(request: Request, path = "/admin/servers") {
  return NextResponse.redirect(new URL(path, request.url), 303);
}

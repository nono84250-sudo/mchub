import { NextResponse } from "next/server";
import { createLauncherSession, identityErrorResponse, isAuthorizedLauncherRequest, normalizeMinecraftUuid, verifyMinecraftProfile } from "@/lib/launcherAuth";
import { rateLimitResponse } from "@/lib/rateLimit";
import { findOrCreateUserByMinecraft } from "@/lib/users";
import { withD1Busy } from "@/lib/d1Busy";

// Echange le jeton Mojang du joueur (X-Minecraft-Token, verifie aupres de Mojang)
// contre un jeton de session signe de 15 min (X-Launcher-Session sur les autres
// routes, voir LAUNCHER_SESSION_TTL_MS). Voir createLauncherSession dans lib/launcherAuth.ts.
async function handlePOST(request: Request) {
  if (!isAuthorizedLauncherRequest(request)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  const limited = rateLimitResponse(request, "launcher-session", 30);
  if (limited) return limited;

  const body = await request.json().catch(() => null);
  const minecraftUuid = String(body?.minecraftUuid ?? "").trim();
  if (!minecraftUuid) {
    return NextResponse.json({ error: "minecraftUuid manquant" }, { status: 400 });
  }
  const { check: identity, name, lock } = await verifyMinecraftProfile(request.headers.get("x-minecraft-token"), minecraftUuid);
  if (identity !== "verified") {
    // Compte verrouille (fiche joueur, panel admin) : motif clair plutot que le "Identite non
    // verifiee" generique, mais SEULEMENT si Mojang a confirme que le jeton appartient a cet
    // UUID (lock n'est rempli que dans ce cas). Avant le 14/10, le verrou etait relu sur l'UUID
    // declare : n'importe qui pouvait lire le motif de n'importe quel joueur (audit, S2).
    if (lock) {
      return NextResponse.json({ error: `Compte verrouillé${lock.lockedReason ? " : " + lock.lockedReason : "."}` }, { status: 403 });
    }
    return identityErrorResponse(identity);
  }

  // Vraie connexion Microsoft dans le launcher (bouton « Se connecter », pas une reprise de
  // session ni un renouvellement) : le joueur revient de lui-meme, donc on cree son compte
  // meme s'il l'avait supprime (l'empreinte est effacee). Les autres appels ne recreent
  // jamais un compte supprime (voir findOrCreateUserByMinecraft et la route presence). Un
  // echec ici ne doit pas empecher la session : la presence prendra le relais.
  if (body?.freshLogin === true) {
    try {
      await findOrCreateUserByMinecraft(minecraftUuid, name, { explicit: true });
    } catch (error) {
      console.error("[launcher/session] creation du compte a la connexion impossible", error);
    }
  }

  // Le pseudo signe dans le jeton est celui que Mojang vient de confirmer (jamais celui du corps).
  const session = createLauncherSession(normalizeMinecraftUuid(minecraftUuid), name);
  if (!session) {
    return NextResponse.json({ error: "Sessions launcher non configurées sur le serveur" }, { status: 503 });
  }
  return NextResponse.json(session);
}

export const POST = withD1Busy(handlePOST);

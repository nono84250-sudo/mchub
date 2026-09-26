// Chaine Xbox Live -> XSTS -> Minecraft, executee cote serveur juste apres
// l'echange OAuth Microsoft de NextAuth (voir auth.ts) — port quasi direct
// de launcher/src/msAuth.js (authenticateXboxLive/authenticateXsts/
// loginWithXbox/getMinecraftProfile), le launcher faisant deja exactement
// cette meme chaine depuis sa propre fenetre de connexion Microsoft. Garde
// intentionnellement les deux implementations separees (site vs Electron)
// plutot que de partager un package commun : les environnements d'execution
// (fetch cote Node/Vercel vs Electron) et la gestion d'erreurs UI (page web
// vs BrowserWindow) divergent assez pour que la duplication reste plus
// simple qu'une abstraction partagee pour ces ~60 lignes.

const REQUEST_TIMEOUT_MS = 8000;

async function fetchWithTimeout(url: string, options: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Le serveur Microsoft n'a pas répondu à temps.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export class PendingApprovalError extends Error {
  constructor() {
    super("En attente de validation Microsoft pour l'accès à l'API Minecraft.");
    this.name = "PendingApprovalError";
  }
}

async function authenticateXboxLive(msAccessToken: string) {
  const res = await fetchWithTimeout("https://user.auth.xboxlive.com/user/authenticate", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      Properties: { AuthMethod: "RPS", SiteName: "user.auth.xboxlive.com", RpsTicket: `d=${msAccessToken}` },
      RelyingParty: "http://auth.xboxlive.com",
      TokenType: "JWT",
    }),
  });
  if (!res.ok) throw new Error("Échec de l'authentification Xbox Live");
  return res.json();
}

async function authenticateXsts(xblToken: string) {
  const res = await fetchWithTimeout("https://xsts.auth.xboxlive.com/xsts/authorize", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      Properties: { SandboxId: "RETAIL", UserTokens: [xblToken] },
      RelyingParty: "rp://api.minecraftservices.com/",
      TokenType: "JWT",
    }),
  });
  const data = await res.json();
  if (res.status === 401) {
    if (data.XErr === 2148916233) throw new Error("Ce compte Microsoft n'a pas de profil Xbox associé.");
    if (data.XErr === 2148916238) {
      throw new Error("Ce compte est un compte enfant : il doit être ajouté à une famille Microsoft.");
    }
    throw new Error(`Compte Xbox refusé (code ${data.XErr}).`);
  }
  if (!res.ok) throw new Error("Échec de l'autorisation XSTS");
  return data;
}

async function loginWithXbox(xstsToken: string, userHash: string) {
  const res = await fetchWithTimeout("https://api.minecraftservices.com/authentication/login_with_xbox", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ identityToken: `XBL3.0 x=${userHash};${xstsToken}` }),
  });
  if (res.status === 403) throw new PendingApprovalError();
  if (!res.ok) throw new Error("Échec de la connexion Minecraft");
  return res.json();
}

async function getMinecraftProfile(minecraftAccessToken: string) {
  const res = await fetchWithTimeout("https://api.minecraftservices.com/minecraft/profile", {
    headers: { Authorization: `Bearer ${minecraftAccessToken}` },
  });
  if (res.status === 403) throw new PendingApprovalError();
  if (res.status === 404) throw new Error("Ce compte Microsoft ne possède pas Minecraft.");
  if (!res.ok) throw new Error("Impossible de récupérer le profil Minecraft");
  return res.json();
}

export type MinecraftProfile = { uuid: string; name: string };

// Point d'entree unique appele depuis le callback jwt() de NextAuth (voir
// auth.ts) avec l'access_token Microsoft obtenu lors du flux OAuth (scope
// "openid XboxLive.signin offline_access" — voir la config du provider).
export async function getMinecraftProfileFromMicrosoftToken(msAccessToken: string): Promise<MinecraftProfile> {
  const xbl = await authenticateXboxLive(msAccessToken);
  const userHash = xbl.DisplayClaims.xui[0].uhs;
  const xsts = await authenticateXsts(xbl.Token);
  const mcAuth = await loginWithXbox(xsts.Token, userHash);
  const profile = await getMinecraftProfile(mcAuth.access_token);
  return { uuid: profile.id, name: profile.name };
}

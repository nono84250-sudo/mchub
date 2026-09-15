const crypto = require("node:crypto");
const { BrowserWindow } = require("electron");

// Connexion joueur via compte Microsoft -> Xbox Live -> Minecraft, suivant le
// flux officiel documente par Microsoft/Mojang (OAuth2 + PKCE, sans secret
// client puisque l'appli est un "client public"). Voir cahier des charges,
// section 4 : l'inscription Entra suffit pour les 3 premieres etapes, mais
// l'appel final vers api.minecraftservices.com est bloque (403) jusqu'a
// validation manuelle par Microsoft (formulaire aka.ms/mce-reviewappid) --
// exactement comme tous les autres launchers tiers ont du le faire.

const CLIENT_ID = "5ce3be4b-5a19-4eb2-93a8-bd106d0c2f9e";
const REDIRECT_URI = "https://login.microsoftonline.com/common/oauth2/nativeclient";
const AUTHORITY = "https://login.microsoftonline.com/consumers";
const SCOPE = "XboxLive.signin offline_access";

// Erreur speciale : distincte des vraies pannes reseau, pour afficher un
// message clair plutot qu'une erreur brute tant que Microsoft n'a pas
// approuve l'AppID.
class PendingApprovalError extends Error {
  constructor() {
    super("En attente de validation Microsoft pour l'accès à l'API Minecraft.");
    this.name = "PendingApprovalError";
  }
}

function base64url(buffer) {
  return buffer.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function createPkcePair() {
  const verifier = base64url(crypto.randomBytes(32));
  const challenge = base64url(crypto.createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
}

function buildAuthUrl(challenge) {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: "code",
    redirect_uri: REDIRECT_URI,
    response_mode: "query",
    scope: SCOPE,
    code_challenge: challenge,
    code_challenge_method: "S256",
    prompt: "select_account",
  });
  return `${AUTHORITY}/oauth2/v2.0/authorize?${params.toString()}`;
}

function openLoginWindow(authUrl) {
  return new Promise((resolve, reject) => {
    const win = new BrowserWindow({
      width: 480,
      height: 640,
      title: "Connexion Microsoft",
      autoHideMenuBar: true,
      webPreferences: {
        partition: "persist:mchub-microsoft-account",
        nodeIntegration: false,
        contextIsolation: true,
      },
    });

    let settled = false;
    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      win.removeAllListeners("closed");
      win.close();
      fn(value);
    };

    const checkUrl = (url) => {
      if (!url.startsWith(REDIRECT_URI)) return;
      const parsed = new URL(url);
      const code = parsed.searchParams.get("code");
      const error = parsed.searchParams.get("error_description") || parsed.searchParams.get("error");
      if (code) finish(resolve, code);
      else finish(reject, new Error(error || "Connexion annulée"));
    };

    win.webContents.on("will-redirect", (_event, url) => checkUrl(url));
    win.webContents.on("will-navigate", (_event, url) => checkUrl(url));
    win.on("closed", () => finish(reject, new Error("Fenêtre de connexion fermée")));

    win.loadURL(authUrl);
  });
}

async function exchangeCodeForToken(code, verifier) {
  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    grant_type: "authorization_code",
    code,
    redirect_uri: REDIRECT_URI,
    code_verifier: verifier,
    scope: SCOPE,
  });
  const res = await fetch(`${AUTHORITY}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || "Échec de l'échange du code Microsoft");
  return data;
}

async function authenticateXboxLive(msAccessToken) {
  const res = await fetch("https://user.auth.xboxlive.com/user/authenticate", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      Properties: {
        AuthMethod: "RPS",
        SiteName: "user.auth.xboxlive.com",
        RpsTicket: `d=${msAccessToken}`,
      },
      RelyingParty: "http://auth.xboxlive.com",
      TokenType: "JWT",
    }),
  });
  if (!res.ok) throw new Error("Échec de l'authentification Xbox Live");
  return res.json();
}

async function authenticateXsts(xblToken) {
  const res = await fetch("https://xsts.auth.xboxlive.com/xsts/authorize", {
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

async function loginWithXbox(xstsToken, userHash) {
  const res = await fetch("https://api.minecraftservices.com/authentication/login_with_xbox", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ identityToken: `XBL3.0 x=${userHash};${xstsToken}` }),
  });
  if (res.status === 403) throw new PendingApprovalError();
  const data = await res.json();
  if (!res.ok) throw new Error("Échec de la connexion Minecraft");
  return data;
}

async function getMinecraftProfile(minecraftAccessToken) {
  const res = await fetch("https://api.minecraftservices.com/minecraft/profile", {
    headers: { Authorization: `Bearer ${minecraftAccessToken}` },
  });
  if (res.status === 403) throw new PendingApprovalError();
  if (res.status === 404) throw new Error("Ce compte Microsoft ne possède pas Minecraft.");
  const data = await res.json();
  if (!res.ok) throw new Error("Impossible de récupérer le profil Minecraft");
  return data;
}

async function signIn() {
  const { verifier, challenge } = createPkcePair();
  const authUrl = buildAuthUrl(challenge);

  const code = await openLoginWindow(authUrl);
  const msToken = await exchangeCodeForToken(code, verifier);
  const xbl = await authenticateXboxLive(msToken.access_token);
  const userHash = xbl.DisplayClaims.xui[0].uhs;
  const xsts = await authenticateXsts(xbl.Token);
  const xuid = xsts.DisplayClaims.xui[0].xid;
  const mcAuth = await loginWithXbox(xsts.Token, userHash);
  const profile = await getMinecraftProfile(mcAuth.access_token);

  // Format attendu par minecraft-launcher-core (voir mcLaunch.js) — construit
  // nous-memes puisque MCLC ne gere pas l'auth Microsoft lui-meme.
  const authorization = {
    access_token: mcAuth.access_token,
    client_token: crypto.randomUUID(),
    uuid: profile.id,
    name: profile.name,
    user_properties: "{}",
    meta: { type: "msa", demo: false, xuid, clientId: CLIENT_ID },
  };

  return { profile, authorization };
}

module.exports = { signIn, PendingApprovalError };

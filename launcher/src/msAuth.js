const crypto = require("node:crypto");
const { BrowserWindow, session } = require("electron");

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
const REQUEST_TIMEOUT_MS = 8000;
// Cookies de la fenetre de connexion Microsoft (gardes sur disque entre deux connexions).
const LOGIN_PARTITION = "persist:mchub-microsoft-account";

// Sans ça, un serveur Microsoft/Xbox qui ne répond jamais bloquerait la
// promesse indéfiniment — et comme boot() attend la restauration de session
// avant d'afficher quoi que ce soit, la fenêtre resterait vide pour toujours.
async function fetchWithTimeout(url, options) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error.name === "AbortError") throw new Error("Le serveur Microsoft n'a pas répondu à temps.");
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

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

// Anti-CSRF : une valeur aleatoire renvoyee telle quelle par Microsoft dans
// l'URL de retour, verifiee avant d'accepter le "code" qui l'accompagne —
// l'architecture BrowserWindow actuelle (qui intercepte deja cette URL de
// retour dans checkUrl ci-dessous pour en extraire "code") permet de la relire
// facilement, donc pas besoin de documenter une impossibilite ici (point mineur
// de l'audit du 2026-10-10).
function createState() {
  return crypto.randomBytes(16).toString("hex");
}

function buildAuthUrl(challenge, state) {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: "code",
    redirect_uri: REDIRECT_URI,
    response_mode: "query",
    scope: SCOPE,
    code_challenge: challenge,
    code_challenge_method: "S256",
    prompt: "select_account",
    state,
  });
  return `${AUTHORITY}/oauth2/v2.0/authorize?${params.toString()}`;
}

function openLoginWindow(authUrl, expectedState) {
  return new Promise((resolve, reject) => {
    const win = new BrowserWindow({
      width: 480,
      height: 640,
      title: "Connexion Microsoft",
      autoHideMenuBar: true,
      webPreferences: {
        partition: LOGIN_PARTITION,
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
      },
    });

    let settled = false;
    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      win.removeAllListeners("closed");
      // Quand finish() est appele DEPUIS le handler "closed" (fenetre deja
      // fermee par l'utilisateur), la fenetre est deja detruite a ce stade —
      // rappeler win.close() dessus levait "Object has been destroyed" et
      // plantait le process principal.
      if (!win.isDestroyed()) win.close();
      fn(value);
    };

    const checkUrl = (url) => {
      if (!url.startsWith(REDIRECT_URI)) return;
      const parsed = new URL(url);
      const code = parsed.searchParams.get("code");
      const error = parsed.searchParams.get("error_description") || parsed.searchParams.get("error");
      if (error) {
        finish(reject, new Error(error));
        return;
      }
      if (!code) {
        finish(reject, new Error("Connexion annulée"));
        return;
      }
      if (parsed.searchParams.get("state") !== expectedState) {
        finish(reject, new Error("Réponse de connexion Microsoft invalide (jeton anti-CSRF incorrect) — réessaie."));
        return;
      }
      finish(resolve, code);
    };

    win.webContents.on("will-redirect", (_event, url) => checkUrl(url));
    win.webContents.on("will-navigate", (_event, url) => checkUrl(url));
    win.webContents.on("did-fail-load", (_event, errorCode) => {
      // errorCode -3 (ERR_ABORTED) est normal quand will-redirect a deja
      // intercepte l'URL de retour avant la fin du chargement — pas une
      // vraie panne reseau, `finish` ignore de toute facon les appels une
      // fois la connexion deja resolue.
      if (errorCode === -3) return;
      finish(reject, new Error("Impossible de contacter Microsoft — vérifie ta connexion internet."));
    });
    win.on("closed", () => finish(reject, new Error("Fenêtre de connexion fermée")));

    win.loadURL(authUrl);
  });
}

async function requestToken(params) {
  const res = await fetchWithTimeout(`${AUTHORITY}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: CLIENT_ID, scope: SCOPE, ...params }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(data.error_description || "Échec de l'échange avec Microsoft");
    // "invalid_grant" = le refresh_token lui-meme est invalide/revoque par
    // Microsoft. Les autres codes (reseau, indisponibilite temporaire...)
    // ne veulent pas dire que le refresh_token est mauvais.
    error.code = data.error;
    throw error;
  }
  // Un proxy d'entreprise/portail captif peut repondre 200 avec du HTML au lieu
  // du JSON attendu : .catch(() => ({})) ci-dessus evite le crash brut, mais il
  // faut encore detecter l'objet vide resultant plutot que de renvoyer un jeton
  // d'acces manquant en silence (trouve par l'audit du 2026-10-10).
  if (!data.access_token) {
    throw new Error("Réponse Microsoft illisible (ni jeton d'accès, ni erreur claire) — réessaie plus tard.");
  }
  return data; // { access_token, refresh_token, expires_in, ... }
}

function exchangeCodeForToken(code, verifier) {
  return requestToken({
    grant_type: "authorization_code",
    code,
    redirect_uri: REDIRECT_URI,
    code_verifier: verifier,
  });
}

function refreshAccessToken(refreshToken) {
  return requestToken({ grant_type: "refresh_token", refresh_token: refreshToken });
}

async function authenticateXboxLive(msAccessToken) {
  const res = await fetchWithTimeout("https://user.auth.xboxlive.com/user/authenticate", {
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
  const data = await res.json().catch(() => ({}));
  if (!data.Token || !data.DisplayClaims?.xui?.[0]?.uhs) {
    throw new Error("Réponse Xbox Live illisible ou incomplète — réessaie plus tard.");
  }
  return data;
}

async function authenticateXsts(xblToken) {
  const res = await fetchWithTimeout("https://xsts.auth.xboxlive.com/xsts/authorize", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      Properties: { SandboxId: "RETAIL", UserTokens: [xblToken] },
      RelyingParty: "rp://api.minecraftservices.com/",
      TokenType: "JWT",
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) {
    if (data.XErr === 2148916233) throw new Error("Ce compte Microsoft n'a pas de profil Xbox associé.");
    if (data.XErr === 2148916238) {
      throw new Error("Ce compte est un compte enfant : il doit être ajouté à une famille Microsoft.");
    }
    throw new Error(`Compte Xbox refusé${data.XErr ? ` (code ${data.XErr})` : ""}.`);
  }
  if (!res.ok) throw new Error("Échec de l'autorisation XSTS");
  // "Token" est le seul champ reellement indispensable (utilise pour loginWithXbox juste apres) —
  // DisplayClaims.xui[0].xid (xuid) n'est PAS garanti par Microsoft contrairement a "uhs" sur la
  // reponse XBL (ligne 197) : il sert seulement a une metadonnee facultative du lancement
  // (meta.xuid, voir buildAuthorization). L'exiger ici bloquait a tort la connexion de comptes
  // dont la reponse XSTS ne le renvoie pas (regression du 2026-10-10, corrigee le soir meme).
  if (!data.Token) {
    throw new Error("Réponse XSTS illisible ou incomplète — réessaie plus tard.");
  }
  return data;
}

async function loginWithXbox(xstsToken, userHash) {
  const res = await fetchWithTimeout("https://api.minecraftservices.com/authentication/login_with_xbox", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ identityToken: `XBL3.0 x=${userHash};${xstsToken}` }),
  });
  if (res.status === 403) throw new PendingApprovalError();
  if (!res.ok) throw new Error("Échec de la connexion Minecraft");
  const data = await res.json().catch(() => ({}));
  if (!data.access_token) {
    throw new Error("Réponse de connexion Minecraft illisible — réessaie plus tard.");
  }
  return data;
}

async function getMinecraftProfile(minecraftAccessToken) {
  const res = await fetchWithTimeout("https://api.minecraftservices.com/minecraft/profile", {
    headers: { Authorization: `Bearer ${minecraftAccessToken}` },
  });
  if (res.status === 403) throw new PendingApprovalError();
  if (res.status === 404) throw new Error("Ce compte Microsoft ne possède pas Minecraft.");
  if (!res.ok) throw new Error("Impossible de récupérer le profil Minecraft");
  const data = await res.json().catch(() => ({}));
  if (!data.id || !data.name) {
    throw new Error("Profil Minecraft illisible ou incomplet — réessaie plus tard.");
  }
  return data;
}

// Format attendu par minecraft-launcher-core (voir mcLaunch.js) — construit
// nous-memes puisque MCLC ne gere pas l'auth Microsoft lui-meme.
function buildAuthorization({ accessToken, uuid, name, xuid, clientId }) {
  return {
    access_token: accessToken,
    client_token: crypto.randomUUID(),
    uuid,
    name,
    user_properties: "{}",
    meta: { type: "msa", demo: false, xuid, clientId },
  };
}

// Suite commune une fois qu'on a un access_token Microsoft valide (que ce
// soit juste apres la connexion interactive, ou via un refresh_token
// memorise) : Xbox Live -> XSTS -> Minecraft -> profil.
async function finishSignIn(msAccessToken) {
  const xbl = await authenticateXboxLive(msAccessToken);
  const userHash = xbl.DisplayClaims.xui[0].uhs;
  const xsts = await authenticateXsts(xbl.Token);
  // Facultatif (voir le commentaire dans authenticateXsts) : ne doit jamais faire planter la
  // connexion si absent.
  const xuid = xsts.DisplayClaims?.xui?.[0]?.xid;
  const mcAuth = await loginWithXbox(xsts.Token, userHash);
  const profile = await getMinecraftProfile(mcAuth.access_token);

  const authorization = buildAuthorization({
    accessToken: mcAuth.access_token,
    uuid: profile.id,
    name: profile.name,
    xuid,
    clientId: CLIENT_ID,
  });

  return { profile, authorization };
}

async function signIn() {
  const { verifier, challenge } = createPkcePair();
  const state = createState();
  const authUrl = buildAuthUrl(challenge, state);

  const code = await openLoginWindow(authUrl, state);
  const msToken = await exchangeCodeForToken(code, verifier);
  const result = await finishSignIn(msToken.access_token);
  return { ...result, refreshToken: msToken.refresh_token };
}

// Reconnexion silencieuse (sans fenetre) a partir d'un refresh_token
// memorise ("Se souvenir de moi") — Microsoft peut renvoyer un nouveau
// refresh_token a chaque utilisation (et invalider l'ancien), donc on
// renvoie toujours le dernier pour que l'appelant le re-sauvegarde.
async function refreshSession(refreshToken) {
  const msToken = await refreshAccessToken(refreshToken);
  const latestRefreshToken = msToken.refresh_token || refreshToken;

  try {
    const result = await finishSignIn(msToken.access_token);
    return { ...result, refreshToken: latestRefreshToken };
  } catch (error) {
    // Microsoft a peut-etre deja renouvele (et donc invalide l'ancien) le
    // refresh_token meme si la suite echoue ensuite (ex: en attente
    // d'approbation Minecraft) — on l'attache a l'erreur pour que
    // l'appelant le sauvegarde quand meme, sinon la session memorisee
    // devient orpheline des le prochain essai.
    error.rotatedRefreshToken = latestRefreshToken;
    throw error;
  }
}

// Deconnexion / suppression d'un compte (audit 25/10) : efface les cookies Microsoft de la
// fenetre de connexion, pour que le compte ne reste pas ouvert sur ce PC. Ne rejette jamais :
// la deconnexion elle-meme ne doit pas echouer pour ca. Renvoie false si l'effacement a rate.
async function clearLoginStorage() {
  try {
    await session.fromPartition(LOGIN_PARTITION).clearStorageData();
    return true;
  } catch {
    return false;
  }
}

module.exports = { signIn, refreshSession, clearLoginStorage, PendingApprovalError };

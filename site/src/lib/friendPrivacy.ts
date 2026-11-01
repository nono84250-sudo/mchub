import { execSql } from "@/lib/db";

// « Qui peut m'ajouter en ami » (variante C validee par Rushi le 18/10) : meme reglage sur la
// page Amis et dans Parametres > Confidentialite (site et launcher).
//   all  : n'importe qui, avec mon pseudo ;
//   code : seulement avec mon code d'ami (defaut, plus sur pour les enfants) ;
//   none : personne (rien n'est efface : demandes recues et amis restent).
// Les regles sont appliquees par le serveur (sendFriendRequest), jamais par l'interface.
//
// Colonnes friendPolicy / friendCode : migration d1/migrations/2026-10-18-qui-peut-m-ajouter.sql.
// Tant qu'elle n'est pas lancee sur la base utilisee, laisser ce drapeau a false : l'ancien
// comportement (demande par pseudo) reste en place et la carte de reglage est cachee.
// Migration lancee sur DEV le 18/10 (accord de Rushi). Avant la production : la lancer sur la
// base de prod (avec son accord), sinon remettre ce drapeau a false.
export const FRIEND_PRIVACY_READY = true;

export const FRIEND_POLICIES = ["all", "code", "none"] as const;
export type FriendPolicy = (typeof FRIEND_POLICIES)[number];
export const DEFAULT_FRIEND_POLICY: FriendPolicy = "code";

export function isFriendPolicy(v: unknown): v is FriendPolicy {
  return typeof v === "string" && (FRIEND_POLICIES as readonly string[]).includes(v);
}

// Sans 0/O/1/I/L pour qu'un code dicte ou recopie ne se confonde pas.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 6;

// « k7q-9xm », « K7Q9XM » -> « K7Q9XM » ; null si ce n'est pas un code possible.
export function normalizeFriendCode(input: string): string | null {
  const s = input.trim().toUpperCase().replace(/[\s-]/g, "");
  if (s.length !== CODE_LENGTH) return null;
  for (const ch of s) if (!ALPHABET.includes(ch)) return null;
  return s;
}

// Affichage « K7Q-9XM ».
export function formatFriendCode(code: string): string {
  return `${code.slice(0, 3)}-${code.slice(3)}`;
}

function randomCode(): string {
  const bytes = new Uint8Array(CODE_LENGTH);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => ALPHABET[b % ALPHABET.length]).join("");
}

export type FriendSettings = { friendPolicy: FriendPolicy; friendCode: string };

// Lit le reglage, et cree le code s'il n'existe pas encore (premiere ouverture de la page Amis).
export async function getFriendSettings(userId: string): Promise<FriendSettings> {
  const [row] = (await execSql('SELECT "friendPolicy", "friendCode" FROM "user" WHERE "id" = ?', [userId])) as {
    friendPolicy: string | null;
    friendCode: string | null;
  }[];
  const friendPolicy = isFriendPolicy(row?.friendPolicy) ? row.friendPolicy : DEFAULT_FRIEND_POLICY;
  const friendCode = row?.friendCode ?? (await setNewFriendCode(userId));
  return { friendPolicy, friendCode };
}

export async function setFriendPolicy(userId: string, policy: FriendPolicy): Promise<void> {
  await execSql('UPDATE "user" SET "friendPolicy" = ? WHERE "id" = ?', [policy, userId]);
}

// « Changer de code » : l'ancien code ne marche plus. Les demandes deja envoyees avec l'ancien
// code restent valables (elles sont deja en base). Reessaie en cas de doublon (index unique).
export async function setNewFriendCode(userId: string): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = randomCode();
    try {
      await execSql('UPDATE "user" SET "friendCode" = ? WHERE "id" = ?', [code, userId]);
      return code;
    } catch {
      // doublon : on tire un autre code
    }
  }
  throw new Error("friend code generation failed");
}

// Cible d'une demande d'ami : par code (accepte si 'all' ou 'code'), sinon par pseudo
// (accepte seulement si 'all'). Renvoie null si personne ne doit la recevoir — l'appelant
// repond TOUJOURS la meme chose (anti-enumeration).
export async function resolveFriendTarget(query: string): Promise<string | null> {
  const trimmed = query.trim();
  if (!trimmed) return null;

  const code = normalizeFriendCode(trimmed);
  if (code) {
    const [byCode] = (await execSql('SELECT "id", "friendPolicy" FROM "user" WHERE "friendCode" = ? LIMIT 1', [code])) as {
      id: string;
      friendPolicy: string;
    }[];
    if (byCode && (byCode.friendPolicy === "all" || byCode.friendPolicy === "code")) return byCode.id;
    // Pas un code connu : peut-etre un pseudo de 6 caracteres, on continue.
  }

  // Pseudos Minecraft insensibles a la casse ; la ligne la plus recemment mise a jour l'emporte
  // (meme regle que sendFriendRequest avant ce reglage).
  const [byName] = (await execSql(
    'SELECT "id", "friendPolicy" FROM "user" WHERE lower("minecraftUsername") = lower(?) ORDER BY "updatedAt" DESC LIMIT 1',
    [trimmed],
  )) as { id: string; friendPolicy: string }[];
  if (byName && byName.friendPolicy === "all") return byName.id;
  return null;
}

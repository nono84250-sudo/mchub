import { db, execSql } from "@/lib/db";
import { pingMinecraftServer } from "@/lib/mc-ping";

// File d'attente "Vérification" du panel admin (voir Design/Omniscient Admin Dashboard
// Mockups, ecran "verification") : les serveurs nouvellement crees restent en
// verificationStatus = 'pending' (invisibles de l'annuaire, voir le filtre dans
// public-servers.ts) jusqu'a la decision d'un admin. Les serveurs qui existaient deja
// avant cette fonctionnalite sont a 'approved' par defaut (voir d1/schema.sql) :
// rien ne disparait de l'annuaire au deploiement de cette migration.

export type VerificationStatus = "pending" | "approved" | "rejected";

export type VerificationChecks = {
  checkedAt: string;
  reachable: boolean | null;
  detectedVersion: string | null;
  declaredVersion: string;
  versionMismatch: boolean;
  similarName: { name: string; score: number } | null;
  contentFlags: string[];
};

type HistoryEntry = { at: string; text: string };

// --- Contenu (slurs / insultes / contenu degradant) ---
// Liste volontairement courte et simple (FR + EN) : un wordlist + regex a frontieres de
// mot suffit pour flaguer pour revue manuelle (jamais d'auto-rejet, voir rejectServer/
// approveServer plus bas) — facile a etendre, pas besoin d'un service externe ou de ML.
// ponytail: liste minimale, a completer au fil des faux-negatifs rencontres en prod.
const BANNED_WORDS = [
  // EN
  "nigger", "nigga", "faggot", "fag", "retard", "retarded", "whore", "slut", "cunt", "bitch",
  "rape", "nazi", "hitler", "kike", "spic", "tranny", "fuck", "fucking", "asshole",
  // FR
  "pute", "putain", "salope", "connard", "conard", "enculé", "enfoiré", "negre", "nègre",
  "pédé", "pd", "batard", "bâtard", "nazisme", "violeur", "sale arabe", "sale noir",
];

// Substitutions "leetspeak" courantes (0/o, 5/s, @/a...) : appliquees caractere a caractere,
// donc la longueur du texte ne change pas et les frontieres de mot (\b) restent valides apres
// coup — "c0nnard" devient "connard" et matche normalement.
const LEET_MAP: Record<string, string> = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", "$": "s", "!": "i", "|": "i" };

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // retire les accents pour matcher les deux graphies (ex. "pédé"/"pede")
    .replace(/[01345789@$!|]/g, (c) => LEET_MAP[c] ?? c);
}

// Version "compactee" : separateurs (espace, tiret, underscore, point) retires entre les
// lettres, pour attraper "c-o-n-n-a-r-d" / "c_o_n_n_a_r_d" / "c o n n a r d". Recherche en
// sous-chaine (pas de \b, les frontieres n'existent plus une fois les separateurs retires) —
// risque de faux positif sur un mot court contenu dans un mot plus long (ex. "fag" dans
// "flag"), donc reservee aux entrees d'au moins 5 caracteres ; les entrees courtes restent
// uniquement sur la passe a frontieres de mot ci-dessous.
function compact(text: string): string {
  return normalize(text).replace(/[\s._-]+/g, "");
}

const BANNED_PATTERNS = BANNED_WORDS.map((w) => ({ word: w, re: new RegExp(`\\b${normalize(w).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i") }));
const COMPACT_PATTERNS = BANNED_WORDS.filter((w) => w.replace(/\s/g, "").length >= 5).map((w) => ({ word: w, needle: compact(w) }));

// Retourne les mots bannis trouves (frontieres de mot : "contenu" ne matche jamais "con",
// "classic" ne matche jamais "ass" — evite le faux-positif substring classique). Deux passes :
// texte normal (frontieres de mot, fiable, tous les mots) + texte compacte (sous-chaine, mots
// longs seulement, attrape l'evasion par separateurs). Jamais d'auto-rejet derriere ce flag
// (voir rejectServer/approveServer) : un faux positif occasionnel reste revu par un humain.
export function findBannedWords(...texts: string[]): string[] {
  const haystack = normalize(texts.join(" \n "));
  const found = BANNED_PATTERNS.filter((p) => p.re.test(haystack)).map((p) => p.word);
  const compacted = compact(texts.join(" \n "));
  for (const p of COMPACT_PATTERNS) if (compacted.includes(p.needle)) found.push(p.word);
  return [...new Set(found)];
}

// Distance de Levenshtein classique (DP), suffisante pour comparer un nom a quelques
// dizaines/centaines de noms publies — pas besoin d'une lib tierce pour ca.
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const prev = Array.from({ length: n + 1 }, (_, j) => j);
  let curr = new Array(n + 1).fill(0);
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      curr[j] = a[i - 1] === b[j - 1] ? prev[j - 1] : 1 + Math.min(prev[j], curr[j - 1], prev[j - 1]);
    }
    for (let j = 0; j <= n; j++) prev[j] = curr[j];
  }
  return prev[n];
}

// Score de similarite 0..1 (1 = identique). Seuil de flag choisi assez haut (0.82) pour
// ne pas remonter deux noms juste "du meme genre" (ex. "Nether Rails" vs "Nether Lands"
// doit flaguer, mais pas deux noms qui partagent juste un mot courant).
const NAME_SIMILARITY_THRESHOLD = 0.82;

export function findSimilarName(name: string, existingNames: string[]): { name: string; score: number } | null {
  const needle = normalize(name.trim());
  let best: { name: string; score: number } | null = null;
  for (const candidate of existingNames) {
    const other = normalize(candidate.trim());
    if (!other || other === needle) continue;
    const dist = levenshtein(needle, other);
    const score = 1 - dist / Math.max(needle.length, other.length, 1);
    if (score >= NAME_SIMILARITY_THRESHOLD && (!best || score > best.score)) best = { name: candidate, score };
  }
  return best;
}

// Lance les controles automatiques (jointabilite + version detectee, nom proche, contenu
// banni) — ne bloque ni ne rejette jamais rien : ca ne fait que remplir ce que l'admin voit
// dans le panneau de detail de la file de verification (voir verificationHtml dans bind.ts).
export async function runAutomatedChecks(input: {
  name: string;
  description: string;
  minecraftVersion: string;
  ip: string;
  existingNames: string[];
}): Promise<VerificationChecks> {
  const ping = await pingMinecraftServer(input.ip);
  const detectedVersion = ping?.versionName ?? null;
  return {
    checkedAt: new Date().toISOString(),
    reachable: ping ? true : null, // null = injoignable (jamais "false" : voir l'ecran "erreur" de la maquette, retente plutot qu'un rejet net)
    detectedVersion,
    declaredVersion: input.minecraftVersion,
    versionMismatch: !!detectedVersion && detectedVersion !== input.minecraftVersion,
    similarName: findSimilarName(input.name, input.existingNames),
    contentFlags: findBannedWords(input.name, input.description),
  };
}

function parseHistory(raw: string | null | undefined): HistoryEntry[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function summarizeChecks(checks: VerificationChecks): string {
  const flags: string[] = [];
  if (checks.reachable === null) flags.push("adresse injoignable");
  if (checks.versionMismatch) flags.push("écart de version détecté");
  if (checks.similarName) flags.push(`nom proche de « ${checks.similarName.name} »`);
  if (checks.contentFlags.length) flags.push("contenu à vérifier");
  return flags.length ? `Mise en attente — ${flags.join(", ")}` : "Vérification automatique terminée — aucun écart détecté";
}

// Appelee par createServer (nouvelle fiche) et updateServer (fiche rejetee ou encore en
// attente qui est modifiee — voir lib/actions/servers.ts) : calcule les controles, les
// enregistre, et ajoute les lignes d'historique correspondantes.
export async function runAndStoreChecks(serverId: string, submittedBy: string, isResubmission: boolean): Promise<void> {
  const server = await db.orm.public.Server.where({ id: serverId }).first();
  if (!server) return;

  const published = await db.orm.public.Server.select("name").where({ published: true, isPrivate: false }).all();
  const existingNames = published.map((s: { name: string }) => s.name).filter((n: string) => n !== server.name);

  const checks = await runAutomatedChecks({
    name: server.name,
    description: server.description,
    minecraftVersion: server.minecraftVersion,
    ip: server.ip,
    existingNames,
  });

  const history = parseHistory(server.verificationHistory);
  history.push({
    at: checks.checkedAt,
    text: isResubmission ? `Resoumis par ${submittedBy} — vérification automatique relancée` : `Soumis par ${submittedBy} — vérification automatique lancée`,
  });
  history.push({ at: checks.checkedAt, text: summarizeChecks(checks) });

  await db.orm.public.Server.where({ id: serverId }).update({
    verificationStatus: "pending",
    verificationChecks: JSON.stringify(checks),
    verificationHistory: JSON.stringify(history),
  });
}

export type PendingServerSummary = {
  id: string;
  slug: string;
  name: string;
  createdAt: string;
  status: VerificationStatus;
  ownerName: string;
  checks: VerificationChecks | null;
};

export async function listVerificationQueue(status: VerificationStatus): Promise<PendingServerSummary[]> {
  // Exclut les fiches jamais soumises a une vraie revue (verificationHistory encore a son
  // defaut '[]') — sans ca, n'importe quelle fiche privee (verificationStatus='approved' par
  // defaut, voir schema.sql) apparaissait a tort dans l'onglet "Valides" (decouvert le
  // 2026-10-10 sur des serveurs de test prives). Filtre sur l'historique plutot que sur
  // isPrivate (corrige le 2026-10-11) : un serveur REFUSE repasse desormais prive (voir
  // rejectServer, pour que "Tester pour publication" reapparaisse cote launcher) mais doit
  // quand meme rester visible dans l'onglet "Refusés" — isPrivate ne distingue plus "jamais
  // soumis" de "deja refuse puis redevenu prive".
  const rows = await db.orm.public.Server.select("id", "slug", "name", "createdAt", "verificationStatus", "verificationChecks", "verificationHistory")
    .include("owner", (o) => o.select("name"))
    .where({ verificationStatus: status })
    .orderBy((s) => s.createdAt.desc())
    .all();
  return rows
    .filter((r: Record<string, unknown>) => r.verificationHistory && r.verificationHistory !== "[]")
    .map((r: Record<string, unknown>) => ({
      id: r.id as string,
      slug: r.slug as string,
      name: r.name as string,
      createdAt: r.createdAt as string,
      status: r.verificationStatus as VerificationStatus,
      ownerName: (r.owner as { name: string } | null)?.name ?? "—",
      checks: r.verificationChecks ? (JSON.parse(r.verificationChecks as string) as VerificationChecks) : null,
    }));
}

// Compte seul (sans les lignes ni le join owner) : utilise pour le badge "Vérification" du
// menu lateral (voir markNavBadges dans design/bind.ts), affiche sur CHAQUE page admin, ainsi
// que pour les compteurs des onglets "Validés"/"Refusés" de /admin/verification (qui n'ont
// besoin que d'un nombre pour le badge, pas des lignes completes avec le join owner).
// `excludePrivate` doit valoir true pour matcher exactement le filtre de listVerificationQueue
// (verificationHistory non vide, voir le commentaire la-bas — pas isPrivate, corrige le
// 2026-10-11) — utilise par les compteurs d'onglets de /admin/verification, qui doivent rester
// coherents avec les lignes affichees quand on change d'onglet. Le badge du menu lateral
// (countPendingVerification) ne filtre pas sur l'historique : comportement existant conserve.
export async function countVerificationByStatus(status: VerificationStatus, options: { excludePrivate?: boolean } = {}): Promise<number> {
  const sql = options.excludePrivate
    ? `SELECT COUNT(*) as count FROM "server" WHERE "verificationStatus" = ? AND "verificationHistory" != '[]'`
    : `SELECT COUNT(*) as count FROM "server" WHERE "verificationStatus" = ?`;
  const rows = (await execSql(sql, [status])) as { count: number }[];
  return rows[0]?.count ?? 0;
}

export async function countPendingVerification(): Promise<number> {
  return countVerificationByStatus("pending");
}

export type VerificationDetail = PendingServerSummary & {
  ownerId: string;
  ownerMinecraftUuid: string | null;
  history: HistoryEntry[];
  verificationReason: string | null;
  // Auto-test du proprietaire reussi dans le launcher (voir
  // /api/launcher/servers/[slug]/self-test) : complement au controle
  // automatique ci-dessus (checks), jamais un remplacement — l'admin voit
  // les deux cote a cote dans verificationHtml (bind.ts).
  selfTestPassedAt: string | null;
  selfTestDetectedVersion: string | null;
};

export async function getVerificationDetail(serverId: string): Promise<VerificationDetail | null> {
  const row = await db.orm.public.Server.select(
    "id", "slug", "name", "createdAt", "ownerId", "verificationStatus", "verificationChecks", "verificationHistory", "verificationReason",
    "selfTestPassedAt", "selfTestDetectedVersion",
  )
    .include("owner", (o) => o.select("name", "minecraftUuid"))
    .where({ id: serverId })
    .first();
  if (!row) return null;
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    createdAt: row.createdAt,
    status: row.verificationStatus,
    ownerId: row.ownerId,
    ownerName: row.owner?.name ?? "—",
    ownerMinecraftUuid: row.owner?.minecraftUuid ?? null,
    checks: row.verificationChecks ? JSON.parse(row.verificationChecks) : null,
    history: parseHistory(row.verificationHistory),
    verificationReason: row.verificationReason ?? null,
    selfTestPassedAt: row.selfTestPassedAt ?? null,
    selfTestDetectedVersion: row.selfTestDetectedVersion ?? null,
  };
}

async function appendHistory(serverId: string, text: string, extra: Record<string, unknown> = {}): Promise<void> {
  const server = await db.orm.public.Server.where({ id: serverId }).first();
  if (!server) return;
  const history = parseHistory(server.verificationHistory);
  history.push({ at: new Date().toISOString(), text });
  await db.orm.public.Server.where({ id: serverId }).update({ verificationHistory: JSON.stringify(history), ...extra });
}

export async function approveServer(serverId: string): Promise<void> {
  await appendHistory(serverId, "Validé par un administrateur — publication autorisée", {
    verificationStatus: "approved",
    verificationReason: null,
  });
}

// Repasse la fiche privee et efface l'auto-test (2026-10-11) : depuis que reussir le test
// dans le launcher soumet directement la fiche (voir le self-test/route.ts), un refus doit
// faire reapparaitre le bouton "Tester pour publication" cote launcher — canSelfTest()
// (renderer.js) exige isPrivate + aucun selfTestPassedAt, exactement l'etat d'une fiche
// jamais soumise. Le proprietaire corrige le probleme signale (voir verificationReason) puis
// retente depuis zero, plutot que de rester bloque sans aucune action possible.
export async function rejectServer(serverId: string, reason: string): Promise<void> {
  await appendHistory(serverId, `Refusé par un administrateur — ${reason}`, {
    verificationStatus: "rejected",
    verificationReason: reason,
    isPrivate: true,
    selfTestPassedAt: null,
    selfTestDetectedVersion: null,
  });
}

export async function requestServerInfo(serverId: string, message: string): Promise<void> {
  await appendHistory(serverId, `Informations demandées par un administrateur — ${message}`);
}

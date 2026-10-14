import { execSql } from "@/lib/db";

// Export des donnees d'un joueur (droit d'acces, RGPD art. 15) : bouton « Recuperer les donnees
// du joueur » de la fiche joueur admin, voir components/admin/PlayerExportButton.tsx et
// /api/admin/player-export. Chaque requete liste ses colonnes une par une (jamais de SELECT *
// sur une table qui porte un secret) : rien ici ne doit sortir un jeton de session, un code
// d'invitation, l'identite d'un autre joueur qui a signale ses serveurs, ni un identifiant
// interne d'admin.

export const EXPORT_CATEGORIES = [
  "serveurs",
  "signalementsEnvoyes",
  "signalementsSurSesServeurs",
  "notifications",
  "avertissements",
  "notesDuStaff",
  "amis",
  "presence",
  "serveursSuivis",
] as const;
export type ExportCategory = (typeof EXPORT_CATEGORIES)[number];

export const NOT_INCLUDED = [
  "Jetons et dates de session, secrets du launcher",
  "Codes d'invitation des serveurs privés",
  "Pseudos et UUID des joueurs qui ont signalé ses serveurs",
  "Identifiants internes des admins",
];

type Row = Record<string, unknown>;
const rows = async (sql: string, params: unknown[]) => ((await execSql(sql, params)) as unknown as Row[]) ?? [];
const bool = (v: unknown) => v === true || v === 1 || v === "1";

const REPORT_ISSUES: Record<string, string> = {
  cant_connect: "Impossible de se connecter",
  wrong_version: "Mauvaise version",
  modpack_download: "Téléchargement du modpack",
  crash: "Crash",
  other: "Autre",
};
const REPORT_STATUS: Record<string, string> = { new: "nouveau", replied: "répondu", resolved: "résolu" };

async function loadAccount(userId: string) {
  const [u] = await rows(
    'SELECT "id", "name", "minecraftUuid", "minecraftUsername", "createdAt", "updatedAt", "lockedAt", "lockedReason" FROM "user" WHERE "id" = ?',
    [userId],
  );
  if (!u) return null;
  return {
    id: String(u.id),
    pseudo: String(u.name),
    minecraftUuid: (u.minecraftUuid as string | null) ?? null,
    minecraftUsername: (u.minecraftUsername as string | null) ?? null,
    inscritLe: String(u.createdAt),
    misAJourLe: String(u.updatedAt),
    verrouillage: u.lockedAt ? { depuis: String(u.lockedAt), motif: (u.lockedReason as string | null) ?? null } : null,
  };
}
type Account = NonNullable<Awaited<ReturnType<typeof loadAccount>>>;

const LOADERS: Record<ExportCategory, (account: Account) => Promise<unknown>> = {
  serveurs: async (a) =>
    (
      await rows(
        `SELECT "name", "slug", "ip", "type", "minecraftVersion", "description", "curseforgeModpackName", "curseforgeModpackVersion",
                "published", "isPrivate", "frozenAt", "frozenReason", "appealStatus", "appealRequestedAt", "verificationStatus",
                "verificationReason", "viewCount", "launchCount", "discordUrl", "websiteUrl", "bannerUrl", "iconUrl", "backgroundUrl", "createdAt", "updatedAt"
         FROM "server" WHERE "ownerId" = ? ORDER BY "createdAt"`,
        [a.id],
      )
    ).map((s) => ({
      nom: s.name,
      slug: s.slug,
      adresse: s.ip,
      type: s.type === "modded" ? "moddé" : "vanilla",
      versionMinecraft: s.minecraftVersion,
      description: s.description,
      modpack: s.curseforgeModpackName ? `${s.curseforgeModpackName}${s.curseforgeModpackVersion ? ` ${s.curseforgeModpackVersion}` : ""}` : null,
      publie: bool(s.published),
      prive: bool(s.isPrivate),
      gel: s.frozenAt ? { depuis: s.frozenAt, motif: s.frozenReason ?? null } : null,
      recours: s.appealStatus ? { statut: s.appealStatus, demandeLe: s.appealRequestedAt ?? null } : null,
      verification: { statut: s.verificationStatus, motif: s.verificationReason ?? null },
      statistiques: { vues: Number(s.viewCount ?? 0), lancementsDepuisLeLauncher: Number(s.launchCount ?? 0) },
      discord: s.discordUrl ?? null,
      siteWeb: s.websiteUrl ?? null,
      images: { banniere: s.bannerUrl ?? null, icone: s.iconUrl ?? null, fond: s.backgroundUrl ?? null },
      creeLe: s.createdAt,
      misAJourLe: s.updatedAt,
    })),

  signalementsEnvoyes: async (a) => {
    if (!a.minecraftUuid) return [];
    return (
      await rows(
        `SELECT s."name" AS "serverName", r."category", r."issue", r."behaviorIssue", r."message", r."clientVersion", r."launcherVersion",
                r."status", r."reply", r."proofUrl", r."createdAt"
         FROM "report" r JOIN "server" s ON s."id" = r."serverId"
         WHERE r."reporterMinecraftUuid" = ? ORDER BY r."createdAt" DESC`,
        [a.minecraftUuid],
      )
    ).map((r) => ({
      serveur: r.serverName,
      categorie: r.category === "behavior" ? "comportement / contenu" : "technique",
      probleme: r.behaviorIssue ?? REPORT_ISSUES[String(r.issue)] ?? r.issue,
      message: r.message,
      preuve: r.proofUrl ?? null,
      versionMinecraft: r.clientVersion ?? null,
      versionLauncher: r.launcherVersion ?? null,
      statut: REPORT_STATUS[String(r.status)] ?? r.status,
      reponse: r.reply ?? null,
      envoyeLe: r.createdAt,
    }));
  },

  // Auteur jamais exporte (ni pseudo, ni UUID, ni preuve). Les signalements de comportement ne
  // sont jamais montres au proprietaire dans l'app : on garde leur motif et leur date, pas leur texte.
  signalementsSurSesServeurs: async (a) =>
    (
      await rows(
        `SELECT s."name" AS "serverName", r."category", r."issue", r."behaviorIssue", r."message", r."status", r."reply", r."createdAt"
         FROM "report" r JOIN "server" s ON s."id" = r."serverId"
         WHERE s."ownerId" = ? ORDER BY r."createdAt" DESC`,
        [a.id],
      )
    ).map((r) => {
      const behavior = r.category === "behavior";
      return {
        serveur: r.serverName,
        auteur: "un joueur",
        categorie: behavior ? "comportement / contenu" : "technique",
        probleme: r.behaviorIssue ?? REPORT_ISSUES[String(r.issue)] ?? r.issue,
        message: behavior ? null : r.message,
        statut: REPORT_STATUS[String(r.status)] ?? r.status,
        reponse: behavior ? null : (r.reply ?? null),
        envoyeLe: r.createdAt,
      };
    }),

  notifications: async (a) => {
    if (!a.minecraftUuid) return [];
    return (
      await rows(
        'SELECT "type", "serverName", "message", "read", "createdAt", "eventAt" FROM "notification" WHERE "recipientMinecraftUuid" = ? ORDER BY "createdAt" DESC',
        [a.minecraftUuid],
      )
    ).map((n) => ({ type: n.type, serveur: n.serverName, message: n.message ?? null, lue: bool(n.read), recueLe: n.createdAt, evenementLe: n.eventAt ?? null }));
  },

  avertissements: async (a) =>
    (await rows('SELECT "reason", "createdBy", "createdAt" FROM "playerWarning" WHERE "userId" = ? ORDER BY "createdAt" DESC', [a.id])).map((w) => ({
      motif: w.reason,
      par: w.createdBy,
      le: w.createdAt,
    })),

  notesDuStaff: async (a) =>
    (await rows('SELECT "text", "createdBy", "createdAt" FROM "adminNote" WHERE "userId" = ? ORDER BY "createdAt" DESC', [a.id])).map((n) => ({
      texte: n.text,
      par: n.createdBy,
      le: n.createdAt,
    })),

  // f.* : la table friendship n'a que des identifiants, des dates et le statut de la demande —
  // et les colonnes status/requesterId n'existent pas encore partout (migration demandes d'amis).
  amis: async (a) =>
    (
      await rows(
        `SELECT f.*, u."name" AS "otherName" FROM "friendship" f
         JOIN "user" u ON u."id" = CASE WHEN f."userId1" = ? THEN f."userId2" ELSE f."userId1" END
         WHERE f."userId1" = ? OR f."userId2" = ? ORDER BY f."createdAt" DESC`,
        [a.id, a.id, a.id],
      )
    ).map((f) => ({
      pseudo: f.otherName,
      statut: f.status === "pending" ? (f.requesterId === a.id ? "demande envoyée" : "demande reçue") : "ami",
      depuis: f.createdAt,
    })),

  presence: async (a) => {
    const [p] = await rows('SELECT "lastSeenAt" FROM "userPresence" WHERE "userId" = ?', [a.id]);
    return { derniereActiviteDansLeLauncher: (p?.lastSeenAt as string | undefined) ?? null };
  },

  serveursSuivis: async (a) => {
    if (!a.minecraftUuid) return [];
    return (
      await rows(
        `SELECT s."name" AS "serverName", w."notifyOnStatusChange", w."createdAt"
         FROM "instanceWatch" w JOIN "server" s ON s."id" = w."serverId" WHERE w."minecraftUuid" = ? ORDER BY w."createdAt" DESC`,
        [a.minecraftUuid],
      )
    ).map((w) => ({ serveur: w.serverName, prevenirQuandIlRevientEnLigne: bool(w.notifyOnStatusChange), depuis: w.createdAt }));
  },
};

// Nombre d'elements par categorie, pour la fenetre d'export (avant de generer quoi que ce soit).
export async function countPlayerData(userId: string): Promise<Record<ExportCategory, number>> {
  const account = await loadAccount(userId);
  const counts = {} as Record<ExportCategory, number>;
  for (const key of EXPORT_CATEGORIES) {
    const value = account ? await LOADERS[key](account) : [];
    counts[key] = Array.isArray(value) ? value.length : value ? 1 : 0;
  }
  return counts;
}

async function contactMessages(email: string) {
  return (
    await rows('SELECT "name", "message", "status", "createdAt" FROM "contactMessage" WHERE lower("email") = lower(?) ORDER BY "createdAt" DESC', [email])
  ).map((m) => ({ nom: m.name, message: m.message, envoyeLe: m.createdAt }));
}

const dateFr = (iso: unknown) =>
  iso ? new Date(String(iso)).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Paris" }) : "—";

function fileSlug(name: string) {
  return name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "joueur";
}

export type PlayerExport = { jsonName: string; txtName: string; json: string; summary: string };

export async function buildPlayerExport(
  userId: string,
  { categories, email, adminName, now = new Date() }: { categories: ExportCategory[]; email: string | null; adminName: string; now?: Date },
): Promise<PlayerExport | null> {
  const account = await loadAccount(userId);
  if (!account) return null;

  const picked = EXPORT_CATEGORIES.filter((c) => categories.includes(c));
  const data: Record<string, unknown> = {};
  for (const key of picked) data[key] = await LOADERS[key](account);
  const contact = email ? await contactMessages(email) : null;

  const exportJson = {
    export: {
      service: "Omniscient (omniscientlauncher.com)",
      responsable: "Rushifa · omniscient.launchermc@gmail.com",
      genereLe: now.toISOString(),
      genereePar: adminName,
      joueur: account.pseudo,
      categories: ["compte", ...picked, ...(contact ? ["messagesDeContact"] : [])],
      nonInclus: NOT_INCLUDED,
    },
    compte: account,
    ...data,
    ...(contact ? { messagesDeContact: contact } : {}),
  };

  const day = now.toLocaleDateString("sv-SE", { timeZone: "Europe/Paris" }); // AAAA-MM-JJ
  const slug = fileSlug(account.pseudo);
  const jsonName = `donnees-${slug}-${day}.json`;
  const txtName = `resume-${slug}-${day}.txt`;

  const L: string[] = [];
  const list = <T,>(title: string, items: T[], line: (item: T) => string) => {
    L.push("", `${title} (${items.length})`);
    if (!items.length) L.push("- Aucun");
    for (const item of items) L.push(`- ${line(item)}`);
  };
  L.push(`DONNÉES PERSONNELLES DE ${account.pseudo.toUpperCase()} SUR OMNISCIENT`);
  L.push(`Export du ${dateFr(now.toISOString())}, en réponse à ta demande d'accès (RGPD, article 15).`);
  L.push(`Le fichier joint ${jsonName} contient le détail complet.`);
  L.push("", "TON COMPTE");
  L.push(`- Pseudo : ${account.pseudo}`);
  if (account.minecraftUuid) L.push(`- UUID Minecraft : ${account.minecraftUuid}`);
  L.push(`- Inscrit le ${dateFr(account.inscritLe)}, connexion via Microsoft (nous ne stockons ni ton email ni ton mot de passe)`);
  L.push(`- Compte verrouillé : ${account.verrouillage ? `oui, depuis le ${dateFr(account.verrouillage.depuis)}` : "non"}`);

  type Any = Record<string, unknown>;
  if (data.serveurs) {
    list("TES SERVEURS", data.serveurs as Any[], (s) => {
      const stats = s.statistiques as Any;
      const gel = s.gel as Any | null;
      return `${s.nom} (${s.adresse}) : ${s.publie ? "publié" : "masqué"}${s.prive ? ", privé" : ""}${gel ? `, gelé depuis le ${dateFr(gel.depuis)}${gel.motif ? ` (motif : ${gel.motif})` : ""}` : ""}, ${stats.vues} vues, ${stats.lancementsDepuisLeLauncher} lancements`;
    });
  }
  if (data.signalementsEnvoyes) {
    list("SIGNALEMENTS QUE TU AS ENVOYÉS", data.signalementsEnvoyes as Any[], (r) => `${r.serveur}, le ${dateFr(r.envoyeLe)} : « ${r.message} » (${r.statut})`);
  }
  if (data.signalementsSurSesServeurs) {
    list("SIGNALEMENTS REÇUS SUR TES SERVEURS", data.signalementsSurSesServeurs as Any[], (r) => `${r.serveur}, le ${dateFr(r.envoyeLe)} : ${String(r.probleme).toLowerCase()} (${r.statut}). L'auteur n'est pas communiqué.`);
  }
  if (data.avertissements) list("AVERTISSEMENTS", data.avertissements as Any[], (w) => `${dateFr(w.le)} : ${w.motif}`);
  if (data.notesDuStaff) list("NOTES DE L'ÉQUIPE TE CONCERNANT", data.notesDuStaff as Any[], (n) => `${dateFr(n.le)} : ${n.texte}`);
  if (data.notifications) L.push("", `NOTIFICATIONS REÇUES : ${(data.notifications as Any[]).length} (détail dans le fichier JSON)`);
  if (data.amis) list("AMIS", data.amis as Any[], (f) => `${f.pseudo} : ${f.statut}`);
  if (data.presence) {
    const p = data.presence as Any;
    L.push("", `DERNIÈRE ACTIVITÉ DANS LE LAUNCHER : ${p.derniereActiviteDansLeLauncher ? dateFr(p.derniereActiviteDansLeLauncher) : "aucune"}`);
  }
  if (data.serveursSuivis) list("SERVEURS SUIVIS", data.serveursSuivis as Any[], (w) => `${w.serveur}${w.prevenirQuandIlRevientEnLigne ? " : alerte quand il revient en ligne" : ""}`);
  if (contact) list("MESSAGES ENVOYÉS PAR LE FORMULAIRE CONTACT", contact, (m) => `${dateFr(m.envoyeLe)} : « ${m.message} »`);
  L.push("");
  L.push("Tu peux supprimer ton compte à tout moment depuis Dashboard > Paramètres > Supprimer mon compte.");
  L.push("Pour corriger une information ou poser une question : omniscient.launchermc@gmail.com");

  return { jsonName, txtName, json: JSON.stringify(exportJson, null, 2), summary: L.join("\n") };
}

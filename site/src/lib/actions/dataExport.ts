"use server";

import { auth } from "@/auth";
import { execSql } from "@/lib/db";
import { checkRateLimit } from "@/lib/rateLimit";
import { buildPlayerExport, countSelfData, SELF_CATEGORIES } from "@/lib/playerExport";
import { mailerReady, sendMail } from "@/lib/mailer";

// « Recuperer mes donnees » (Parametres du compte, 23/10) : droit d'acces et de portabilite
// (RGPD art. 15 et 20). Meme contenu que l'export admin (lib/playerExport.ts) sans les notes du
// staff, plus teams, etiquettes et problemes d'installation. Deux sorties : telechargement
// (les deux fichiers reviennent au navigateur) ou e-mail.
// Le compte n'a pas d'adresse e-mail (connexion Microsoft sans le scope email, voir auth.ts) :
// le joueur la tape deux fois, elle sert a cet envoi et n'est ecrite nulle part.
// Une demande reussie par 24 h et par compte, pour proteger le quota D1 (~15 lectures par
// export) : la trace est une note de l'equipe sur la fiche joueur (kind 'export', verrouillee),
// sans l'adresse e-mail. Aucune migration.

const LIMIT_MS = 24 * 60 * 60_000;
const TRACE_BY = "joueur";
const TRACE_KIND = "export";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type DataExportError =
  | "session"
  | "notFound"
  | "tooSoon"
  | "email"
  | "emailMismatch"
  | "emailUnavailable"
  | "sendFailed"
  | "busy"
  | "siteBusy";
export type DataExportInfo = { counts: Record<string, number>; nextAllowedAt: string | null; emailAvailable: boolean };
export type DataExportFiles = { jsonName: string; txtName: string; json: string; summary: string };

// Plafond pour tout le site (23/10, choix de Rushi) : 30 exports par heure au maximum, compte
// sur les traces de l'heure passee (une lecture). Au-dela, le joueur reessaie plus tard : evite
// qu'un pic de demandes touche la limite D1 (~1200 appels / 5 min, ~15 lectures par export).
const SITE_LIMIT_PER_HOUR = 30;
async function siteBusy(): Promise<boolean> {
  const since = new Date(Date.now() - 60 * 60_000).toISOString();
  const rows = (await execSql('SELECT COUNT(*) AS "n" FROM "adminNote" WHERE "createdBy" = ? AND "createdAt" > ?', [TRACE_BY, since])) as unknown as {
    n: number;
  }[];
  return Number(rows?.[0]?.n ?? 0) >= SITE_LIMIT_PER_HOUR;
}

async function lastExportAt(userId: string): Promise<string | null> {
  const rows = (await execSql('SELECT "createdAt" FROM "adminNote" WHERE "userId" = ? AND "createdBy" = ? ORDER BY "createdAt" DESC LIMIT 1', [
    userId,
    TRACE_BY,
  ])) as unknown as { createdAt: string }[];
  return rows?.[0]?.createdAt ?? null;
}
function nextAllowed(last: string | null, now = Date.now()): string | null {
  if (!last) return null;
  const next = new Date(last).getTime() + LIMIT_MS;
  return next > now ? new Date(next).toISOString() : null;
}

async function writeTrace(userId: string, how: "download" | "email") {
  const text = `Le joueur a récupéré ses données lui-même (${how === "email" ? "envoi par e-mail, adresse non gardée" : "téléchargement"}).`;
  try {
    await execSql('INSERT INTO "adminNote" ("id", "userId", "text", "createdBy", "kind") VALUES (?, ?, ?, ?, ?)', [crypto.randomUUID(), userId, text, TRACE_BY, TRACE_KIND]);
  } catch {
    // Base sans la colonne "kind" (migration 2026-10-23-notes-staff pas encore lancee).
    await execSql('INSERT INTO "adminNote" ("id", "userId", "text", "createdBy") VALUES (?, ?, ?, ?)', [crypto.randomUUID(), userId, text, TRACE_BY]);
  }
}

// Ouverture de la fenetre : nombre d'elements par categorie et prochaine demande possible.
export async function getMyDataInfo(): Promise<DataExportInfo | { error: DataExportError }> {
  const session = await auth();
  if (!session?.user?.id) return { error: "session" };
  if (checkRateLimit(`data-info:${session.user.id}`, 10, 60 * 60_000).limited) return { error: "busy" };
  const counts = await countSelfData(session.user.id);
  if (!counts) return { error: "notFound" };
  return { counts, nextAllowedAt: nextAllowed(await lastExportAt(session.user.id)), emailAvailable: mailerReady() };
}

export async function exportMyData(input: {
  mode: "download" | "email";
  email?: string;
  emailConfirm?: string;
  locale?: "fr" | "en";
}): Promise<{ files: DataExportFiles } | { sent: true } | { error: DataExportError; nextAllowedAt?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { error: "session" };
  const userId = session.user.id;
  // Garde en memoire en plus de la trace en base : deux clics tres rapprochés ne lancent qu'un export.
  if (checkRateLimit(`data-export:${userId}`, 3, 60 * 60_000).limited) return { error: "busy" };

  let to: string | null = null;
  if (input.mode === "email") {
    if (!mailerReady()) return { error: "emailUnavailable" };
    const a = String(input.email ?? "").trim().slice(0, 200);
    const b = String(input.emailConfirm ?? "").trim().slice(0, 200);
    if (!EMAIL_RE.test(a)) return { error: "email" };
    if (a.toLowerCase() !== b.toLowerCase()) return { error: "emailMismatch" };
    to = a;
  }

  const next = nextAllowed(await lastExportAt(userId));
  if (next) return { error: "tooSoon", nextAllowedAt: next };
  if (await siteBusy()) return { error: "siteBusy" };

  const result = await buildPlayerExport(userId, { categories: SELF_CATEGORIES, email: null, byPlayer: true });
  if (!result) return { error: "notFound" };

  if (to) {
    const en = input.locale === "en";
    const pseudo = result.jsonName.replace(/^donnees-/, "").replace(/-\d{4}-\d{2}-\d{2}\.json$/, "");
    try {
      await sendMail({
        to,
        subject: en ? "Your Omniscient data" : "Tes données Omniscient",
        text: en
          ? `Hi,\n\nYou asked for a copy of your Omniscient data (account ${pseudo}). Here it is, in two attached files:\n- ${result.txtName}: an easy-to-read summary\n- ${result.jsonName}: the full detail\n\nDidn't ask for this? Sign out of Omniscient everywhere, then write to us.\n\nYou can delete your account any time from Settings > Delete my account.\nA question or something to fix: omniscient.launchermc@gmail.com\n\nThe Omniscient team`
          : `Salut,\n\nTu as demandé une copie de tes données sur Omniscient (compte ${pseudo}). La voici, en deux fichiers joints :\n- ${result.txtName} : un résumé facile à lire\n- ${result.jsonName} : le détail complet\n\nTu n'as pas fait cette demande ? Déconnecte-toi d'Omniscient partout, puis écris-nous.\n\nTu peux supprimer ton compte quand tu veux depuis Paramètres > Supprimer mon compte.\nUne question ou une info à corriger : omniscient.launchermc@gmail.com\n\nL'équipe Omniscient`,
        attachments: [
          { filename: result.txtName, content: result.summary, contentType: "text/plain; charset=utf-8" },
          { filename: result.jsonName, content: result.json, contentType: "application/json; charset=utf-8" },
        ],
      });
    } catch {
      return { error: "sendFailed" };
    }
    await writeTrace(userId, "email");
    return { sent: true };
  }

  await writeTrace(userId, "download");
  return { files: result };
}

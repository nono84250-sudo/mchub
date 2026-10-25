import { NextResponse } from "next/server";
import { listPublicServers } from "@/lib/public-servers";
import { teamsPublic, withoutTeam } from "@/lib/features";
import { getTagCatalog } from "@/lib/tagRequests";
import { rateLimitResponse } from "@/lib/rateLimit";
import { withD1Busy } from "@/lib/d1Busy";
import { jsonWithEtag } from "@/lib/etag";
import { PUBLIC_LIST_CDN_SECONDS, PUBLIC_LIST_CDN_STALE_SECONDS } from "@/lib/refreshSettings";

// API publique en lecture, consommée par le launcher (application Electron,
// Phase 3) : le site reste l'unique source de vérité, l'app ne fait
// qu'afficher ce que renvoie cette route. Ne contient jamais l'IP des
// serveurs (voir lib/public-servers.ts). CORS ouvert : ces données sont
// délibérément publiques, aucune donnée sensible n'y est exposée.
export const revalidate = 60;

const CORS_HEADERS = { "Access-Control-Allow-Origin": "*" };

// Seule route "liste" du périmètre public/launcher sans frein (audit §1.10) : alignée sur
// public-server/[slug] (120/min).
export const GET = withD1Busy(async (request: Request) => {
  const limited = rateLimitResponse(request, "public-servers-list", 120, { headers: CORS_HEADERS });
  if (limited) return limited;
  const [all, { custom }, showTeams] = await Promise.all([listPublicServers(), getTagCatalog(), teamsPublic()]);
  const list = showTeams ? all : all.map(withoutTeam);
  // 23/10 : noms des etiquettes ajoutees ou renommees par l'equipe (« Remplacer une etiquette »),
  // seulement pour celles que porte le serveur : le launcher les affiche a la place de son propre
  // dictionnaire. Champ AJOUTE, un ancien launcher l'ignore. Catalogue en cache : 0 appel D1 de plus.
  const names = new Map(custom.map((c) => [c.id, { fr: c.nameFr, en: c.nameEn }]));
  const servers = list.map((s) => {
    const own = s.tags.filter((tag) => names.has(tag));
    return own.length ? { ...s, tagLabels: Object.fromEntries(own.map((tag) => [tag, names.get(tag)])) } : s;
  });
  // 21/10 : la liste est la meme pour tout le monde (aucune donnee propre a un joueur) : le CDN
  // de Vercel peut la resservir PUBLIC_LIST_CDN_SECONDS (30 s) sans appeler le site. Un serveur
  // retire par la moderation peut donc rester jusqu'a ~1 min dans la liste du launcher, mais sa
  // fiche et « Rejoindre » sont bloques tout de suite (routes sans cache CDN). ETag : 304 si rien
  // n'a change (voir lib/etag.ts).
  return jsonWithEtag(request, { servers }, {
    ...CORS_HEADERS,
    "Cache-Control": `public, s-maxage=${PUBLIC_LIST_CDN_SECONDS}, stale-while-revalidate=${PUBLIC_LIST_CDN_STALE_SECONDS}`,
  });
});

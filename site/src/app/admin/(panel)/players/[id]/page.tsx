import { notFound } from "next/navigation";
import { db, execSql } from "@/lib/db";
import { DesignScreen } from "@/components/admin/DesignScreen";
import { SlotPortal } from "@/components/admin/SlotPortal";
import { PlayerExportButton } from "@/components/admin/PlayerExportButton";
import { requireAdmin } from "@/app/admin/design/guard";
import { playerDetailHtml, type PlayerServerRow } from "@/app/admin/design/bind";
import { countPlayerData, type ExportCategory } from "@/lib/playerExport";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 5;

// Libelles de la fenetre « Récupérer les données du joueur » (meme ordre que EXPORT_CATEGORIES).
const EXPORT_LABELS: Record<ExportCategory, { title: string; desc: string }> = {
  serveurs: { title: "Serveurs possédés", desc: "Fiches, gel, recours, vérification, vues et lancements" },
  signalementsEnvoyes: { title: "Signalements envoyés", desc: "Ceux qu'il a faits sur d'autres serveurs" },
  signalementsSurSesServeurs: { title: "Signalements sur ses serveurs", desc: "Auteurs masqués, texte des signalements de comportement exclu" },
  notifications: { title: "Notifications", desc: "Messages reçus dans le launcher" },
  avertissements: { title: "Avertissements", desc: "Motif, auteur, date" },
  notesDuStaff: { title: "Notes du staff", desc: "Incluses : ce sont des données sur lui" },
  amis: { title: "Amis", desc: "Pseudos et statut des demandes" },
  presence: { title: "Présence", desc: "Dernière activité dans le launcher" },
  serveursSuivis: { title: "Serveurs suivis", desc: "Alertes « revenu en ligne »" },
};

// 2026-10-12 : page desactivee (perimetre admin reduit) ; reactivee le 2026-10-14 pour le bouton
// « Récupérer les données du joueur » (droit d'acces RGPD). La liste des joueurs reste masquee :
// on arrive ici par le lien du proprietaire sur une fiche serveur.
export default async function PlayerDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const admin = await requireAdmin();
  const { id } = await params;
  const query = await searchParams;
  const player = await db.orm.public.User.select("id", "name", "minecraftUuid", "createdAt", "lockedAt", "lockedReason", "lockedBy").where({ id }).first();
  if (!player) notFound();

  const [servers, warnings, notes] = await Promise.all([
    db.orm.public.Server.select("id", "name", "slug", "ip", "published", "isPrivate", "frozenAt").where({ ownerId: id }).orderBy((s) => s.createdAt.desc()).all(),
    db.orm.public.PlayerWarning.select("id", "reason", "createdBy", "createdAt").where({ userId: id }).orderBy((w) => w.createdAt.desc()).all(),
    db.orm.public.AdminNote.select("id", "text", "createdBy", "createdAt").where({ userId: id }).orderBy((n) => n.createdAt.desc()).all(),
  ]);
  const serverIds = servers.map((s) => s.id);
  // Signalements techniques scopes aux serveurs de ce joueur (WHERE serverId IN (...)) — avant,
  // ce fichier chargeait TOUS les signalements techniques de la plateforme puis filtrait en
  // memoire par serverIds, un aller-retour D1 qui grossit avec la plateforme entiere au lieu
  // de rester proportionnel aux serveurs de ce joueur. Le query-builder de db.ts n'a pas
  // d'operateur IN, donc requete SQL directe via execSql (comme ailleurs dans le panel admin).
  const myReports = serverIds.length
    ? ((await execSql(
        `SELECT "serverId", "status" FROM "report" WHERE "category" = 'technical' AND "serverId" IN (${serverIds.map(() => "?").join(",")})`,
        serverIds,
      )) as { serverId: string; status: string }[])
    : [];
  const openByServer = new Map<string, number>();
  for (const r of myReports) if (r.status !== "resolved") openByServer.set(r.serverId, (openByServer.get(r.serverId) ?? 0) + 1);

  const toRow = (s: (typeof servers)[number]): PlayerServerRow => ({
    name: s.name,
    slug: s.slug,
    address: s.ip,
    published: s.published,
    isPrivate: s.isPrivate,
    frozen: s.frozenAt !== null,
    openReports: openByServer.get(s.id) ?? 0,
  });

  // Liste toujours paginee par 5 (plus de « Voir tout / Réduire », demande de Rushi 2026-10-14).
  const pageCount = Math.max(1, Math.ceil(servers.length / PAGE_SIZE));
  const page = Math.min(Math.max(1, Number.parseInt(query.serversPage ?? "1", 10) || 1), pageCount);
  const serversShown = servers.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map(toRow);

  const html = playerDetailHtml({
    id: player.id,
    name: player.name,
    minecraftUuid: player.minecraftUuid,
    createdAt: player.createdAt,
    serversTotal: servers.length,
    serversFrozen: servers.filter((s) => s.frozenAt !== null).length,
    serversShown,
    serversPage: page,
    serversPageCount: pageCount,
    serversFrom: servers.length ? (page - 1) * PAGE_SIZE + 1 : 0,
    serversTo: (page - 1) * PAGE_SIZE + serversShown.length,
    reportsTotal: myReports.length,
    reportsOpen: myReports.filter((r) => r.status !== "resolved").length,
    locked: player.lockedAt !== null,
    lockedReason: player.lockedReason,
    lockedBy: player.lockedBy,
    lockedAt: player.lockedAt,
    warnings,
    notes,
  });
  // Export reserve au role admin (la route le verifie aussi) : un moderateur ne voit pas le bouton.
  const exportCounts = admin.role === "admin" ? await countPlayerData(player.id) : null;
  return (
    <>
      <DesignScreen name="player-detail" html={html} />
      {exportCounts ? (
        <SlotPortal slotId="player-export-slot">
          <PlayerExportButton
            playerId={player.id}
            playerName={player.name}
            categories={(Object.keys(EXPORT_LABELS) as ExportCategory[]).map((key) => ({ key, ...EXPORT_LABELS[key], count: exportCounts[key] }))}
          />
        </SlotPortal>
      ) : null}
    </>
  );
}

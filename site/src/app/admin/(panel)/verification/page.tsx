import { DesignScreen } from "@/components/admin/DesignScreen";
import { requireAdmin } from "@/app/admin/design/guard";
import { verificationHtml } from "@/app/admin/design/bind";
import { listVerificationQueue, getVerificationDetail, countVerificationByStatus, type VerificationStatus } from "@/lib/verification";

export const dynamic = "force-dynamic";

// Les écrans "verification-vide" et "verification-erreur" de la maquette ne sont que des
// états différents de cette même liste (aucun serveur en attente / contrôle injoignable
// pour la fiche ouverte) — une seule vraie page couvre les trois (voir verificationHtml
// dans bind.ts), pas besoin de routes séparées.
export default async function Verification({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin();
  const params = await searchParams;
  const status: VerificationStatus = params.status === "approved" || params.status === "rejected" ? params.status : "pending";

  // Seul l'onglet actif a besoin des lignes completes (avec le join owner) : les deux autres
  // n'affichent qu'un badge de compte, donc un COUNT dedie suffit (countVerificationByStatus)
  // au lieu de charger 3x la file complete avec .all()+include("owner") pour n'en garder
  // qu'un .length sur 2 des 3 resultats.
  const otherStatuses = (["pending", "approved", "rejected"] as const).filter((s) => s !== status);
  const [servers, [countA, countB]] = await Promise.all([
    listVerificationQueue(status),
    Promise.all(otherStatuses.map((s) => countVerificationByStatus(s, { excludePrivate: true }))),
  ]);
  const counts = {
    [status]: servers.length,
    [otherStatuses[0]]: countA,
    [otherStatuses[1]]: countB,
  } as Record<VerificationStatus, number>;

  const selected = params.serverId ? await getVerificationDetail(params.serverId) : null;

  return (
    <DesignScreen
      name="verification"
      html={verificationHtml({
        status,
        counts,
        servers,
        selected,
      })}
    />
  );
}

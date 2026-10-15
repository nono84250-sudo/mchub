import { redirect } from "next/navigation";
import qrcode from "qrcode-generator";
import { AdminTwoFactorSetup, AdminTwoFactorVerify } from "@/components/admin/AdminTwoFactor";
import { execSql } from "@/lib/db";
import { getCurrentAdmin, getPendingAdmin } from "@/lib/adminSession";
import { decryptTotpSecret, encryptTotpSecret, formatSecret, generateTotpSecret, otpauthUri } from "@/lib/adminTotp";

export const dynamic = "force-dynamic";
export const metadata = { title: "Double authentification — Omniscient" };

// Étape obligatoire après le mot de passe, pour tout le staff (jamais pour les joueurs) :
// - compte sans 2FA : QR code à scanner + premier code, puis codes de secours ;
// - compte avec 2FA : code à 6 chiffres (ou code de secours).
// Rien d'autre du panel n'est accessible avant (la session complète n'existe qu'après).
export default async function TwoFactorPage() {
  if (await getCurrentAdmin()) redirect("/admin/servers");
  const pending = await getPendingAdmin();
  if (!pending) redirect("/admin/login");
  if (!pending.totpEnabled && pending.mustChangeCredentials) redirect("/admin/premiere-connexion");

  let content: React.ReactNode;
  if (pending.totpEnabled) {
    content = <AdminTwoFactorVerify username={pending.username} />;
  } else {
    // Secret en attente gardé en base (chiffré) : recharger la page ne change pas le QR code
    // déjà scanné. Illisible (clé changée) ou absent : on en crée un nouveau.
    let secret = pending.totpSecret ? decryptTotpSecret(pending.totpSecret) : null;
    if (!secret) {
      secret = generateTotpSecret();
      await execSql(`UPDATE "adminAccount" SET "totpSecret" = ? WHERE "id" = ? AND "totpEnabledAt" IS NULL`, [
        encryptTotpSecret(secret),
        pending.id,
      ]);
    }
    const qr = qrcode(0, "M");
    qr.addData(otpauthUri(pending.username, secret));
    qr.make();
    content = (
      <AdminTwoFactorSetup
        username={pending.username}
        qrSvg={qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true })}
        secret={formatSecret(secret)}
      />
    );
  }

  return (
    <>
      <link rel="stylesheet" href="/admin/nocturne.css" />
      <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "var(--color-bg)", color: "var(--color-text)", padding: 16 }}>
        <div style={{ width: 380, maxWidth: "100%", display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ width: 16, height: 16, border: "1.5px solid var(--color-accent)", transform: "rotate(45deg)", flexShrink: 0 }} />
            <span style={{ fontWeight: 600, fontSize: 17 }}>Omniscient</span>
            <span style={{ fontSize: 11.5, padding: "3px 9px", borderRadius: 999, background: "var(--color-accent-800)", color: "var(--color-accent-100)" }}>Admin</span>
          </div>
          {content}
        </div>
      </main>
    </>
  );
}

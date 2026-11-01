import { AdminChrome } from "@/components/admin/AdminChrome";
import { AdminCredentialsForm } from "@/components/admin/AdminCredentialsForm";
import { AdminSourceToggles } from "@/components/admin/AdminSourceToggles";
import { AdminRecoveryCodesCard } from "@/components/admin/AdminTwoFactor";
import { ConfirmSubmitButton } from "@/components/admin/ConfirmSubmitButton";
import { db } from "@/lib/db";
import { requireAdmin } from "@/app/admin/design/guard";
import { allSourceStates, getStaffRoleLabels } from "@/lib/platformSettings";

export const dynamic = "force-dynamic";
export const metadata = { title: "Paramètres — Omniscient" };

// 2026-10-12 : reconstruite avec le vrai cadre Nocturne (AdminChrome) — jusqu'ici cette page
// etait un <main> nu sans sidebar ni style, seule page du panel a ne pas ressembler aux
// autres (signale par l'utilisateur). AdminCredentialsForm et AdminSourceToggles sont de
// vrais composants client interactifs : ils ne peuvent pas passer par le HTML statique de
// DesignScreen (dangerouslySetInnerHTML), d'ou ce cadre dedie plutot que DesignScreen.
// 2026-10-15 : cartes en grille plutôt qu'une par ligne (demande de Rushi). Les colonnes suivent
// la largeur de la zone de contenu (container query), pas celle de l'écran, pour tenir compte de
// la barre latérale : 1 colonne sur mobile, 2 dès ~640px (Identifiants à gauche, Double auth +
// Sources empilées à droite), 3 dès ~1100px ; la carte Staff (tableau) toujours sur toute la largeur.
const SETTINGS_GRID_CSS = `
.settings-wrap { container-type: inline-size; }
.settings-grid { display: grid; gap: 20px; align-items: start; grid-template-columns: minmax(0, 1fr);
  grid-template-areas: "cred" "tfa" "staff" "src"; }
.settings-cred { grid-area: cred; } .settings-tfa { grid-area: tfa; }
.settings-staff { grid-area: staff; } .settings-src { grid-area: src; }
@container (min-width: 640px) {
  .settings-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); grid-template-areas: "cred tfa" "cred src" "staff staff"; }
}
@container (min-width: 1100px) {
  .settings-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); grid-template-areas: "cred tfa src" "staff staff staff"; }
}
`;

export default async function AdminSettings({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const admin = await requireAdmin();
  const params = await searchParams;
  // Carte « Staff » (admins seulement, 2026-10-15) : la page Administration est désactivée depuis
  // le 12/10, c'est donc ici qu'on voit qui a configuré sa 2FA et qu'on la remet à zéro pour un
  // membre qui a perdu téléphone ET codes de secours (choix de Rushi).
  const staff =
    admin.role === "admin"
      ? await db.orm.public.AdminAccount.select("id", "username", "role", "totpEnabledAt").orderBy((a) => a.createdAt.desc()).all()
      : [];
  const roleLabels = admin.role === "admin" ? await getStaffRoleLabels() : null;
  // 2026-10-10 : AdminSourceToggles existait, fonctionnel, mais n'etait rendu sur aucune page —
  // cette page de parametres admin (deja branchee sur le reste des reglages du compte) est
  // l'endroit le plus coherent pour les interrupteurs des sources de modpacks.
  const sources = await allSourceStates();

  const cardStyle: React.CSSProperties = {
    background: "var(--color-surface)",
    border: "1px solid var(--color-divider)",
    borderRadius: "var(--radius-lg)",
    padding: 22,
    minWidth: 0,
  };

  return (
    <AdminChrome>
      <style>{SETTINGS_GRID_CSS}</style>
      <div className="settings-wrap">
      <h1 style={{ margin: "0 0 20px", fontSize: 22, fontWeight: 500 }}>Paramètres</h1>

      <div className="settings-grid">
      <section className="settings-cred" style={cardStyle}>
        <h2 style={{ margin: "0 0 14px", fontSize: 15, fontWeight: 500 }}>Identifiants du compte</h2>
        <AdminCredentialsForm firstLogin={false} currentUsername={admin.username} />
      </section>

      <section className="settings-tfa" style={cardStyle}>
        <h2 style={{ margin: "0 0 14px", fontSize: 15, fontWeight: 500 }}>Double authentification</h2>
        <AdminRecoveryCodesCard />
      </section>

      {roleLabels && (
        <section className="settings-staff" style={cardStyle}>
          <h2 style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 500 }}>Staff</h2>
          <p style={{ margin: "0 0 14px", fontSize: 13, color: "var(--muted)" }}>
            Double authentification de chaque compte. « Réinitialiser » sert quand un membre a perdu son téléphone et ses codes de secours :
            il la reconfigure à sa prochaine connexion.
          </p>
          {params.reset2fa === "1" && (
            <p role="status" style={{ margin: "0 0 12px", padding: "10px 12px", borderRadius: "var(--radius-md)", fontSize: 13, color: "var(--success)", background: "color-mix(in srgb, var(--success) 12%, transparent)" }}>
              Double authentification réinitialisée : le membre la reconfigurera à sa prochaine connexion.
            </p>
          )}
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: "left", fontSize: 11, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted2)" }}>
                  <th style={{ padding: "0 10px 8px 0", fontWeight: 500 }}>Membre</th>
                  <th style={{ padding: "0 10px 8px", fontWeight: 500 }}>Rôle</th>
                  <th style={{ padding: "0 10px 8px", fontWeight: 500 }}>Double auth.</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {staff.map((m) => {
                  const on = !!m.totpEnabledAt;
                  const color = on ? "var(--success)" : "var(--warn)";
                  return (
                    <tr key={m.id} style={{ borderTop: "1px solid var(--color-divider)" }}>
                      <td style={{ padding: "10px 10px 10px 0", whiteSpace: "nowrap" }}>
                        {m.username}
                        {m.id === admin.id && <span style={{ color: "var(--muted)" }}> (toi)</span>}
                      </td>
                      <td style={{ padding: 10, color: "var(--muted)", whiteSpace: "nowrap" }}>{m.role === "admin" ? roleLabels.admin : roleLabels.moderator}</td>
                      <td style={{ padding: 10, whiteSpace: "nowrap" }}>
                        <span style={{ fontSize: 12, padding: "2px 9px", borderRadius: 999, color, background: `color-mix(in srgb, ${color} 14%, transparent)` }}>
                          {on ? "Activée" : "À configurer"}
                        </span>
                      </td>
                      <td style={{ padding: "10px 0 10px 10px", textAlign: "right" }}>
                        {on && m.id !== admin.id && (
                          <form method="post" action={`/api/admin/staff/${m.id}/2fa-reset`}>
                            <ConfirmSubmitButton
                              confirmText={`${m.username} devra refaire la configuration (QR code) à sa prochaine connexion. Ses anciens codes ne marcheront plus. Continuer ?`}
                              style={{ font: "inherit", fontSize: 12.5, padding: "5px 10px", borderRadius: "var(--radius-md)", border: "1px solid var(--color-divider)", background: "transparent", color: "var(--color-text)", cursor: "pointer", whiteSpace: "nowrap" }}
                            >
                              Réinitialiser
                            </ConfirmSubmitButton>
                          </form>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="settings-src" style={cardStyle}>
        <h2 style={{ margin: "0 0 14px", fontSize: 15, fontWeight: 500 }}>Sources de modpacks</h2>
        <AdminSourceToggles initial={sources} />
      </section>
      </div>
      </div>
    </AdminChrome>
  );
}

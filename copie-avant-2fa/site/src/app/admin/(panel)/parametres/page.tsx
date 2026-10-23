import { AdminChrome } from "@/components/admin/AdminChrome";
import { AdminCredentialsForm } from "@/components/admin/AdminCredentialsForm";
import { AdminSourceToggles } from "@/components/admin/AdminSourceToggles";
import { requireAdmin } from "@/app/admin/design/guard";
import { allSourceStates } from "@/lib/platformSettings";

export const dynamic = "force-dynamic";
export const metadata = { title: "Paramètres — Omniscient" };

// 2026-10-12 : reconstruite avec le vrai cadre Nocturne (AdminChrome) — jusqu'ici cette page
// etait un <main> nu sans sidebar ni style, seule page du panel a ne pas ressembler aux
// autres (signale par l'utilisateur). AdminCredentialsForm et AdminSourceToggles sont de
// vrais composants client interactifs : ils ne peuvent pas passer par le HTML statique de
// DesignScreen (dangerouslySetInnerHTML), d'ou ce cadre dedie plutot que DesignScreen.
export default async function AdminSettings() {
  const admin = await requireAdmin();
  // 2026-10-10 : AdminSourceToggles existait, fonctionnel, mais n'etait rendu sur aucune page —
  // cette page de parametres admin (deja branchee sur le reste des reglages du compte) est
  // l'endroit le plus coherent pour les interrupteurs des sources de modpacks.
  const sources = await allSourceStates();

  const cardStyle: React.CSSProperties = {
    background: "var(--color-surface)",
    border: "1px solid var(--color-divider)",
    borderRadius: "var(--radius-lg)",
    padding: 22,
  };

  return (
    <AdminChrome>
      <h1 style={{ margin: "0 0 20px", fontSize: 22, fontWeight: 500 }}>Paramètres</h1>

      <section style={{ ...cardStyle, marginBottom: 20 }}>
        <h2 style={{ margin: "0 0 14px", fontSize: 15, fontWeight: 500 }}>Identifiants du compte</h2>
        <AdminCredentialsForm firstLogin={false} currentUsername={admin.username} />
      </section>

      <section style={cardStyle}>
        <h2 style={{ margin: "0 0 14px", fontSize: 15, fontWeight: 500 }}>Sources de modpacks</h2>
        <AdminSourceToggles initial={sources} />
      </section>
    </AdminChrome>
  );
}

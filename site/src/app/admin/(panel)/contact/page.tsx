import { AdminChrome } from "@/components/admin/AdminChrome";
import { requireAdmin } from "@/app/admin/design/guard";
import { listContactMessages } from "@/lib/contactMessages";
import { ConfirmSubmitButton } from "@/components/admin/ConfirmSubmitButton";

export const dynamic = "force-dynamic";
export const metadata = { title: "Contact — Omniscient" };

// 2026-10-14 : page hors maquette d'origine (comme /admin/parametres) — mêmes raisons, même
// méthode : AdminChrome plutôt que DesignScreen, car "Marquer comme lu" et "Supprimer" sont de vraies actions,
// pas juste du HTML statique. Même esprit que /admin/reports (liste, plus récent en premier,
// détail inline), mais formulaire public plutôt que signalement lié à un serveur.
export default async function AdminContact() {
  await requireAdmin();
  const messages = await listContactMessages();

  const cardStyle: React.CSSProperties = {
    background: "var(--color-surface)",
    border: "1px solid var(--color-divider)",
    borderRadius: "var(--radius-lg)",
    padding: 22,
  };

  const actionStyle = (color: string): React.CSSProperties => ({
    border: `1px solid ${color}`,
    color,
    background: "transparent",
    padding: "8px 16px",
    borderRadius: "var(--radius-md)",
    font: "500 13.5px var(--font-heading)",
    cursor: "pointer",
  });

  return (
    <AdminChrome active="contact">
      <h1 style={{ margin: "0 0 20px", fontSize: 22, fontWeight: 500 }}>Contact</h1>

      {messages.length === 0 ? (
        <section style={cardStyle}>
          <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>Aucun message pour le moment.</p>
        </section>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {messages.map((m) => (
            <section key={m.id} style={cardStyle}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                <div style={{ minWidth: 0 }}>
                  <p style={{ margin: 0, fontWeight: 500, overflowWrap: "anywhere" }}>
                    {m.name} <span style={{ color: "var(--muted)", fontWeight: 400 }}>· {m.email}</span>
                  </p>
                  <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--muted)" }}>
                    {new Date(m.createdAt).toLocaleDateString("fr-FR", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    fontSize: 11.5,
                    padding: "3px 9px",
                    borderRadius: 999,
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                    background:
                      m.status === "new"
                        ? "color-mix(in srgb, var(--color-accent) 16%, transparent)"
                        : "color-mix(in srgb, var(--color-text) 10%, transparent)",
                    color: m.status === "new" ? "var(--color-accent)" : "var(--muted)",
                  }}
                >
                  {m.status === "new" ? "Nouveau" : "Lu"}
                </span>
              </div>
              <p style={{ margin: "12px 0 0", fontSize: 13.5, lineHeight: 1.6, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{m.message}</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 12 }}>
                {m.status === "new" ? (
                  <form method="post" action={`/api/admin/contact/${m.id}/read`}>
                    <button type="submit" style={actionStyle("var(--color-accent)")}>
                      Marquer comme lu
                    </button>
                  </form>
                ) : null}
                <form method="post" action={`/api/admin/contact/${m.id}/delete`}>
                  <ConfirmSubmitButton confirmText="Supprimer définitivement ce message ?" style={actionStyle("var(--danger)")}>
                    Supprimer
                  </ConfirmSubmitButton>
                </form>
              </div>
            </section>
          ))}
        </div>
      )}
    </AdminChrome>
  );
}

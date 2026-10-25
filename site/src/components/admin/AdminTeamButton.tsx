"use client";

import { useState } from "react";

// Bouton « Teams » de la fiche joueur (panel admin, teams 19/10) : creer une team pour le joueur
// (sans limite de nombre), changer le nom et la description d'une de ses teams (les noms reserves
// comme « Omniscient » sont permis ici), retirer l'icone ou la description, ou supprimer une team.
// Le joueur choisit lui-meme quels serveurs vont dans quelle team (onglet « Ma team »). Formulaires classiques vers
// /api/admin/team (meme principe que les autres actions de la fiche : redirection apres envoi).
// L'icone elle-meme se depose depuis l'onglet « Ma team » du compte du joueur.
type Team = { id: string; name: string; description: string | null; iconUrl: string | null; slug: string };

const BUTTON: React.CSSProperties = {
  border: "1px solid var(--color-divider)",
  color: "var(--color-text)",
  background: "transparent",
  padding: "8px 16px",
  borderRadius: "var(--radius-md)",
  font: "500 13.5px var(--font-heading)",
  cursor: "pointer",
  whiteSpace: "nowrap",
  display: "inline-flex",
  alignItems: "center",
  gap: 7,
  flexShrink: 0,
};
const SMALL: React.CSSProperties = { ...BUTTON, padding: "6px 12px", font: "500 12.5px var(--font-heading)" };
const PRIMARY: React.CSSProperties = { ...BUTTON, border: "1px solid var(--color-accent)", color: "var(--color-accent)" };
const DANGER: React.CSSProperties = { ...SMALL, border: "1px solid var(--danger)", color: "var(--danger)" };
const FIELD: React.CSSProperties = {
  width: "100%",
  border: "1px solid var(--color-divider)",
  background: "var(--color-bg)",
  color: "var(--color-text)",
  borderRadius: "var(--radius-md)",
  padding: "8px 10px",
  font: "400 13.5px var(--font-body, inherit)",
};

export function AdminTeamButton({ userId, teams }: { userId: string; teams: Team[] }) {
  const [open, setOpen] = useState(false);
  const hidden = (action: string, teamId: string | null) => (
    <>
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="teamId" value={teamId ?? ""} />
      <input type="hidden" name="action" value={action} />
    </>
  );

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} style={BUTTON}>
        <i className="ph ph-users-three" style={{ fontSize: 14.5 }} />
        {teams.length === 1 ? `Team : ${teams[0].name}` : teams.length ? `Teams (${teams.length})` : "Team"}
      </button>
      {open ? (
        <div
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
          style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(5,6,12,.6)", display: "flex", overflowY: "auto", padding: "24px 16px" }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-team-title"
            style={{ width: 520, maxWidth: "100%", margin: "auto", borderRadius: "var(--radius-lg)", background: "var(--color-surface)", color: "var(--color-text)", border: "1px solid var(--color-divider)", boxShadow: "var(--shadow-lg)", overflow: "hidden" }}
          >
            <div style={{ height: 4, background: "var(--color-accent)" }} />
            <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: "22px 24px" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                <div style={{ minWidth: 0 }}>
                  <h2 id="admin-team-title" style={{ margin: 0, fontFamily: "var(--font-heading)", fontWeight: 500, fontSize: 18 }}>
                    Teams du joueur
                  </h2>
                  <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--muted)", lineHeight: 1.5 }}>
                    Le joueur choisit quels serveurs vont dans quelle team. Ici, les noms réservés (Omniscient) sont permis et le
                    nombre de teams n&apos;est pas limité. L&apos;icône se dépose depuis l&apos;onglet « Ma team » de son compte.
                  </p>
                </div>
                <button type="button" onClick={() => setOpen(false)} aria-label="Fermer" style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "var(--muted)", padding: 2 }}>
                  <i className="ph ph-x" style={{ fontSize: 18 }} />
                </button>
              </div>

              {[...teams, null].map((team) => (
                <div
                  key={team?.id ?? "new"}
                  style={{ display: "flex", flexDirection: "column", gap: 10, borderTop: "1px solid var(--color-divider)", paddingTop: 14 }}
                >
                  <p style={{ margin: 0, fontWeight: 500 }}>{team ? team.name : "Nouvelle team"}</p>
                  <form method="post" action="/api/admin/team" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {hidden("save", team?.id ?? null)}
                    <input type="hidden" name="iconUrl" value={team?.iconUrl ?? ""} />
                    <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12.5, color: "var(--muted)" }}>
                      Nom (3 à 24 caractères)
                      <input name="name" defaultValue={team?.name ?? ""} required maxLength={32} style={FIELD} />
                    </label>
                    <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12.5, color: "var(--muted)" }}>
                      Description (160 caractères max, sans lien)
                      <textarea name="description" defaultValue={team?.description ?? ""} rows={2} maxLength={200} style={FIELD} />
                    </label>
                    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                      <button type="submit" style={PRIMARY}>
                        {team ? "Enregistrer" : "Créer la team"}
                      </button>
                    </div>
                  </form>
                  {team ? (
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {team.iconUrl ? (
                        <form method="post" action="/api/admin/team">
                          {hidden("clearIcon", team.id)}
                          <button type="submit" style={SMALL}>Retirer l&apos;icône</button>
                        </form>
                      ) : null}
                      {team.description ? (
                        <form method="post" action="/api/admin/team">
                          {hidden("clearDescription", team.id)}
                          <button type="submit" style={SMALL}>Effacer la description</button>
                        </form>
                      ) : null}
                      <form method="post" action="/api/admin/team" style={{ marginLeft: "auto" }}>
                        {hidden("delete", team.id)}
                        <button type="submit" style={DANGER}>Supprimer la team</button>
                      </form>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

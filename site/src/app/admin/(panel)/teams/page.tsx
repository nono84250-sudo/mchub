import Link from "next/link";
import { AdminChrome } from "@/components/admin/AdminChrome";
import { requireAdmin } from "@/app/admin/design/guard";
import { TeamAvatar } from "@/components/TeamAvatar";
import { teamNamesClash, reservedNameImitated } from "@/lib/teamRules";
import { listAllTeams, listTeamRequests, type AdminTeam } from "@/lib/teams";

export const dynamic = "force-dynamic";
export const metadata = { title: "Teams — Omniscient" };

const DONE: Record<string, string> = {
  accepted: "Team créée. Le joueur est prévenu et peut y mettre ses serveurs.",
  refused: "Demande refusée. Le joueur voit le motif dans « Ma team ».",
  save: "Team renommée.",
  clearIcon: "Icône retirée.",
  clearDescription: "Description effacée.",
  delete: "Team supprimée. Ses serveurs restent en ligne, sans team.",
};

function looksLikeText(l: NonNullable<AdminTeam["looksLike"]>): string {
  if (l.kind === "reserved") return `Imite le nom réservé « ${l.name} ».`;
  if (l.kind === "same") return `Même nom que « ${l.name} » une fois les lettres jumelles remplacées (0 → o, 1 → i…).`;
  return `Ressemble à « ${l.name} » (une lettre de différence).`;
}

// Page admin « Teams » (choix de Rushi du 20/10, preview « Page Teams du panel admin », variante A).
// Onglet « Toutes les teams » : chaque team avec son proprietaire, ses serveurs et sa date, une
// recherche, les noms suspects en premier (imitation d'un nom reserve comme « Omniscient », ou nom
// trop proche d'une team plus ancienne, lib/teamRules.ts) et les actions (renommer, retirer
// l'icone ou la description, supprimer) via /api/admin/team. Onglet « Demandes » : une team de plus
// au-dela des 3 sans demande, avec une raison et une preuve (lien ou image). Accepter cree la team
// (acceptTeamRequest) ; refuser demande un motif, montre au joueur. Meme methode que
// /admin/etiquettes (AdminChrome + vrais formulaires, sans JavaScript).
export default async function AdminTeams({ searchParams }: PageProps<"/admin/teams">) {
  await requireAdmin();
  const params = await searchParams;
  const done = typeof params.done === "string" ? DONE[params.done] : undefined;
  const error = typeof params.error === "string" ? params.error.slice(0, 200) : undefined;
  const q = typeof params.q === "string" ? params.q.trim().slice(0, 60) : "";
  const checkOnly = params.check === "1";
  const tab = params.tab === "demandes" || params.done === "accepted" || params.done === "refused" ? "demandes" : "toutes";
  const [requests, teams] = await Promise.all([listTeamRequests(), listAllTeams()]);
  const pending = requests.filter((r) => r.status === "pending");
  const flaggedCount = teams.filter((t) => t.looksLike).length;
  const needle = q.toLowerCase();
  const shown = teams
    .filter((t) => (!checkOnly || t.looksLike) && (!needle || t.name.toLowerCase().includes(needle) || (t.ownerName ?? "").toLowerCase().includes(needle)))
    .sort((a, b) => Number(!!b.looksLike) - Number(!!a.looksLike));
  // Nom demande trop proche d'une team existante (les noms reserves et identiques sont deja
  // refuses a l'envoi de la demande, mais une team a pu etre creee depuis).
  const requestLooksLike = (name: string): string | null => {
    const reserved = reservedNameImitated(name);
    if (reserved) return `Imite le nom réservé « ${reserved} ».`;
    const other = teams.find((t) => teamNamesClash(t.name, name));
    return other ? `Ressemble à la team « ${other.name} » (${other.ownerName ?? "joueur"}).` : null;
  };
  const handled = requests.filter((r) => r.status !== "pending");

  const card: React.CSSProperties = {
    background: "var(--color-surface)",
    border: "1px solid var(--color-divider)",
    borderRadius: "var(--radius-lg)",
    padding: 22,
  };
  const pill = (color: string): React.CSSProperties => ({
    fontSize: 11.5,
    fontWeight: 600,
    padding: "3px 9px",
    borderRadius: 999,
    whiteSpace: "nowrap",
    background: `color-mix(in srgb, ${color} 16%, transparent)`,
    color,
  });
  const banner = (color: string): React.CSSProperties => ({
    padding: "10px 14px",
    borderRadius: "var(--radius-md)",
    border: `1px solid ${color}`,
    background: `color-mix(in srgb, ${color} 10%, transparent)`,
    color,
    fontSize: 13,
    marginBottom: 16,
  });
  const button = (color: string): React.CSSProperties => ({
    border: `1px solid ${color}`,
    color,
    background: "transparent",
    padding: "8px 16px",
    borderRadius: "var(--radius-md)",
    font: "500 13.5px var(--font-heading)",
    cursor: "pointer",
  });
  const field: React.CSSProperties = {
    flex: "1 1 220px",
    minWidth: 0,
    border: "1px solid var(--color-divider)",
    background: "var(--color-bg)",
    color: "var(--color-text)",
    borderRadius: "var(--radius-md)",
    padding: "8px 10px",
    font: "400 13.5px var(--font-body, inherit)",
  };
  const label: React.CSSProperties = { margin: 0, fontSize: 11.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--muted)" };
  const tabLink = (active: boolean): React.CSSProperties => ({
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "7px 14px",
    borderRadius: "var(--radius-md)",
    border: `1px solid ${active ? "var(--color-accent)" : "var(--color-divider)"}`,
    color: active ? "var(--color-text)" : "var(--muted)",
    fontSize: 13.5,
    fontWeight: 500,
    textDecoration: "none",
  });
  const mini = (color = "var(--color-text)"): React.CSSProperties => ({
    border: `1px solid ${color === "var(--color-text)" ? "var(--color-divider)" : color}`,
    color,
    background: "transparent",
    padding: "6px 12px",
    borderRadius: "var(--radius-md)",
    font: "500 12.5px var(--font-heading)",
    cursor: "pointer",
    textDecoration: "none",
  });
  const when = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }) : "");
  const day = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  const hidden = (team: AdminTeam, action: string) => (
    <>
      <input type="hidden" name="action" value={action} />
      <input type="hidden" name="back" value="teams" />
      <input type="hidden" name="userId" value={team.ownerId} />
      <input type="hidden" name="teamId" value={team.id} />
    </>
  );

  return (
    <AdminChrome active="teams">
      <h1 style={{ margin: "0 0 6px", fontSize: 22, fontWeight: 500 }}>Teams</h1>
      <p style={{ margin: "0 0 16px", fontSize: 13, color: "var(--muted)" }}>
        Jusqu&apos;à 3 teams par compte sans demande, plus sur demande avec une preuve. Les noms qui imitent « Omniscient » ou un autre nom réservé
        (0mniscient, Omn1scient, lettres cyrilliques, fautes de frappe) sont refusés automatiquement ; les noms proches d&apos;une autre team sont
        acceptés mais marqués « À vérifier » ici.
      </p>

      <nav style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }} aria-label="Onglets">
        <Link href="/admin/teams" style={tabLink(tab === "toutes")} aria-current={tab === "toutes" ? "page" : undefined}>
          Toutes les teams
          <span style={{ fontSize: 12, color: "var(--muted)" }}>{teams.length}</span>
          {flaggedCount ? <span style={pill("var(--warn)")}>{flaggedCount} à vérifier</span> : null}
        </Link>
        <Link href="/admin/teams?tab=demandes" style={tabLink(tab === "demandes")} aria-current={tab === "demandes" ? "page" : undefined}>
          Demandes
          {pending.length ? <span style={pill("var(--color-accent)")}>{pending.length}</span> : null}
        </Link>
      </nav>

      {done ? <div style={banner("var(--success)")}>{done}</div> : null}
      {error ? <div style={banner("var(--danger)")}>{error}</div> : null}

      {tab === "toutes" ? (
        <>
          <form method="get" action="/admin/teams" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
            <input name="q" defaultValue={q} placeholder="Chercher un nom ou un joueur" style={field} />
            <label style={{ display: "inline-flex", gap: 6, alignItems: "center", fontSize: 13, color: "var(--muted)" }}>
              <input type="checkbox" name="check" value="1" defaultChecked={checkOnly} />À vérifier seulement
            </label>
            <button type="submit" style={mini()}>
              Chercher
            </button>
          </form>
          {shown.length === 0 ? (
            <section style={{ ...card, textAlign: "center", borderStyle: "dashed" }}>
              <p style={{ margin: 0, fontWeight: 500 }}>{teams.length ? "Aucun résultat" : "Aucune team pour le moment"}</p>
              <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--muted)" }}>
                {teams.length ? "Essaie un autre nom." : "Les teams créées par les joueurs apparaîtront ici."}
              </p>
            </section>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {shown.map((team) => (
                <details
                  key={team.id}
                  style={{
                    ...card,
                    padding: "10px 14px",
                    borderColor: team.looksLike ? "color-mix(in srgb, var(--warn) 60%, transparent)" : "var(--color-divider)",
                  }}
                >
                  <summary style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer", listStyle: "none", flexWrap: "wrap" }}>
                    <TeamAvatar team={team} size={32} />
                    <span style={{ minWidth: 0, flex: "1 1 180px" }}>
                      <span style={{ display: "block", fontWeight: 600, overflowWrap: "anywhere" }}>{team.name}</span>
                      <span style={{ display: "block", fontSize: 12, color: "var(--muted)" }}>
                        {team.ownerName ?? "Joueur"} · {team.serverCount} serveur{team.serverCount > 1 ? "s" : ""} · créée le {day(team.createdAt)}
                      </span>
                    </span>
                    {team.official ? (
                      <span style={pill("var(--color-accent)")}>Officielle</span>
                    ) : team.looksLike ? (
                      <span style={pill("var(--warn)")}>À vérifier</span>
                    ) : (
                      <span style={pill("var(--success)")}>OK</span>
                    )}
                  </summary>
                  {team.looksLike ? (
                    <p
                      style={{
                        margin: "10px 0 0",
                        fontSize: 12.5,
                        color: "var(--muted)",
                        background: "color-mix(in srgb, var(--warn) 8%, transparent)",
                        borderRadius: "var(--radius-md)",
                        padding: "6px 10px",
                      }}
                    >
                      {looksLikeText(team.looksLike)}
                    </p>
                  ) : null}
                  {team.description ? <p style={{ margin: "10px 0 0", fontSize: 13, overflowWrap: "anywhere" }}>{team.description}</p> : null}
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 12, paddingTop: 10, borderTop: "1px dashed var(--color-divider)" }}>
                    <form method="post" action="/api/admin/team" style={{ display: "flex", gap: 6, flex: "1 1 280px", flexWrap: "wrap" }}>
                      {hidden(team, "save")}
                      <input type="hidden" name="description" value={team.description ?? ""} />
                      <input type="hidden" name="iconUrl" value={team.iconUrl ?? ""} />
                      <input name="name" required minLength={3} maxLength={24} defaultValue={team.name} aria-label="Nouveau nom" style={field} />
                      <button type="submit" style={mini()}>
                        Renommer
                      </button>
                    </form>
                    {team.iconUrl ? (
                      <form method="post" action="/api/admin/team">
                        {hidden(team, "clearIcon")}
                        <button type="submit" style={mini()}>
                          Retirer l&apos;icône
                        </button>
                      </form>
                    ) : null}
                    {team.description ? (
                      <form method="post" action="/api/admin/team">
                        {hidden(team, "clearDescription")}
                        <button type="submit" style={mini()}>
                          Effacer la description
                        </button>
                      </form>
                    ) : null}
                    <Link href={`/admin/players/${encodeURIComponent(team.ownerId)}`} style={mini()}>
                      Voir le joueur
                    </Link>
                    <Link href={`/team/${team.slug}`} target="_blank" style={mini()}>
                      Voir la page
                    </Link>
                    {team.official ? null : (
                      <details>
                        <summary style={{ ...mini("var(--danger)"), listStyle: "none" }}>Supprimer la team</summary>
                        <form method="post" action="/api/admin/team" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 8 }}>
                          {hidden(team, "delete")}
                          <span style={{ fontSize: 12.5, color: "var(--muted)" }}>Ses serveurs restent en ligne, sans team. Le nom reste bloqué 30 jours.</span>
                          <button type="submit" style={button("var(--danger)")}>
                            Oui, supprimer
                          </button>
                        </form>
                      </details>
                    )}
                  </div>
                </details>
              ))}
            </div>
          )}
        </>
      ) : pending.length === 0 ? (
        <section style={{ ...card, textAlign: "center", borderStyle: "dashed" }}>
          <p style={{ margin: 0, fontWeight: 500 }}>Aucune demande en attente.</p>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--muted)" }}>Les nouvelles demandes apparaîtront ici.</p>
        </section>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {pending.map((r) => (
            <section key={r.id} style={{ ...card, display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
                <div style={{ minWidth: 0 }}>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: 16, overflowWrap: "anywhere" }}>{r.name}</p>
                  <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "var(--muted)" }}>
                    <Link href={`/admin/players/${encodeURIComponent(r.userId)}`} style={{ color: "var(--color-accent)" }}>
                      {r.userName ?? "Joueur"}
                    </Link>
                    {` · ${r.teamCount} team${r.teamCount > 1 ? "s" : ""} déjà · ${when(r.createdAt)}`}
                  </p>
                </div>
                <span style={pill("var(--warn)")}>En attente</span>
              </div>
              {requestLooksLike(r.name) ? (
                <p style={{ margin: 0, fontSize: 12.5, color: "var(--warn)" }}>{requestLooksLike(r.name)}</p>
              ) : null}
              <div>
                <p style={label}>Pourquoi</p>
                <p style={{ margin: "4px 0 0", fontSize: 13.5, overflowWrap: "anywhere" }}>{r.reason}</p>
              </div>
              <div>
                <p style={label}>Preuve</p>
                {r.proof ? (
                  <p style={{ margin: "4px 0 0", fontSize: 13.5, overflowWrap: "anywhere" }}>
                    {/^https:\/\/[^\s"'<>]+$/.test(r.proof) ? (
                      <a href={r.proof} target="_blank" rel="noopener noreferrer nofollow" style={{ color: "var(--color-accent)" }}>
                        {r.proof}
                      </a>
                    ) : (
                      r.proof
                    )}
                  </p>
                ) : null}
                {r.proofImageUrl ? (
                  <a href={r.proofImageUrl} target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", marginTop: 8 }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={r.proofImageUrl} alt="Image de preuve" style={{ maxWidth: 320, maxHeight: 200, borderRadius: "var(--radius-md)", border: "1px solid var(--color-divider)" }} />
                  </a>
                ) : null}
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", borderTop: "1px solid var(--color-divider)", paddingTop: 12 }}>
                <form method="post" action="/api/admin/team">
                  <input type="hidden" name="action" value="acceptRequest" />
                  <input type="hidden" name="requestId" value={r.id} />
                  <button type="submit" style={button("var(--success)")}>
                    Accepter
                  </button>
                </form>
                <form method="post" action="/api/admin/team" style={{ display: "flex", gap: 8, flex: "1 1 320px", flexWrap: "wrap" }}>
                  <input type="hidden" name="action" value="refuseRequest" />
                  <input type="hidden" name="requestId" value={r.id} />
                  <input name="reason" required maxLength={300} placeholder="Motif du refus (montré au joueur)" style={field} />
                  <button type="submit" style={button("var(--danger)")}>
                    Refuser
                  </button>
                </form>
              </div>
            </section>
          ))}
        </div>
      )}

      {tab === "demandes" && handled.length ? (
        <section style={{ ...card, marginTop: 20 }}>
          <h2 style={{ margin: "0 0 12px", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--muted)" }}>
            Traitées récemment
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {handled.map((r) => (
              <div
                key={r.id}
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "10px 12px", border: "1px solid var(--color-divider)", borderRadius: "var(--radius-md)" }}
              >
                <div style={{ minWidth: 0 }}>
                  <span style={{ fontWeight: 600, overflowWrap: "anywhere" }}>{r.name}</span>
                  <span style={{ fontSize: 12.5, color: "var(--muted)", marginLeft: 8 }}>
                    {r.userName ?? "Joueur"}
                    {r.status === "refused" && r.refuseReason ? ` · ${r.refuseReason}` : ""}
                    {` · ${when(r.decidedAt)}`}
                  </span>
                </div>
                <span style={pill(r.status === "accepted" ? "var(--success)" : "var(--danger)")}>{r.status === "accepted" ? "Acceptée" : "Refusée"}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </AdminChrome>
  );
}

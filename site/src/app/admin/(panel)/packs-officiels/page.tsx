import { AdminChrome } from "@/components/admin/AdminChrome";
import { requireAdmin } from "@/app/admin/design/guard";
import { listAdminPacks } from "@/lib/playPacks";
import { getPlayBeta } from "@/lib/playWorlds";

export const dynamic = "force-dynamic";
export const metadata = { title: "Packs officiels — Omniscient" };

// Page admin « Packs officiels » du mode Jouer (bêta, 24/10, d'après la preview validée par Rushi,
// variante C). Un pack = une liste de mods Modrinth (rien n'est hébergé chez nous). À
// l'enregistrement, chaque version de Minecraft où les mods existent est préparée toute seule
// (lib/playPacks.ts) avec un statut ; seules les versions publiées sont proposées dans le
// launcher. Même méthode que /admin/teams (AdminChrome + vrais formulaires, sans JavaScript).
const STATUS: Record<string, { label: string; color: string }> = {
  tested: { label: "Testée", color: "var(--success)" },
  to_test: { label: "À tester", color: "var(--color-accent)" },
  review: { label: "À revoir", color: "var(--warn)" },
  not_enough: { label: "Pas assez de mods", color: "var(--muted)" },
};
const DONE: Record<string, string> = {
  beta: "Réglage du badge « Bêta » enregistré (launcher, site et admin).",
  tested: "Version marquée « Testée ».",
  untested: "Version remise « À tester ».",
  publish: "Version publiée : elle est proposée dans le launcher.",
  unpublish: "Version retirée du launcher.",
  deleted: "Pack supprimé. Les versions déjà créées par les joueurs gardent leurs mods.",
};

type FileRow = { title?: string; filename: string };
const parse = <T,>(s: string, fallback: T): T => {
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
};

export default async function PacksOfficiels({ searchParams }: PageProps<"/admin/packs-officiels">) {
  await requireAdmin();
  const params = await searchParams;
  const [packs, beta] = await Promise.all([listAdminPacks(), getPlayBeta()]);
  const doneKey = typeof params.done === "string" ? params.done : "";
  const done =
    doneKey === "saved"
      ? `Pack enregistré. Versions préparées : ${params.t ?? 0} à tester, ${params.r ?? 0} à revoir, ${params.n ?? 0} sans assez de mods.`
      : DONE[doneKey];
  const error = typeof params.error === "string" ? params.error.slice(0, 200) : undefined;
  const openPack = typeof params.pack === "string" ? params.pack : null;

  const card: React.CSSProperties = { background: "var(--color-surface)", border: "1px solid var(--color-divider)", borderRadius: "var(--radius-lg)", padding: 22 };
  const pill = (color: string): React.CSSProperties => ({ fontSize: 11.5, fontWeight: 600, padding: "3px 9px", borderRadius: 999, whiteSpace: "nowrap", background: `color-mix(in srgb, ${color} 16%, transparent)`, color });
  const banner = (color: string): React.CSSProperties => ({ padding: "10px 14px", borderRadius: "var(--radius-md)", border: `1px solid ${color}`, background: `color-mix(in srgb, ${color} 10%, transparent)`, color, fontSize: 13, marginBottom: 16 });
  const field: React.CSSProperties = { width: "100%", minWidth: 0, border: "1px solid var(--color-divider)", background: "var(--color-bg)", color: "var(--color-text)", borderRadius: "var(--radius-md)", padding: "8px 10px", font: "400 13.5px var(--font-body, inherit)", boxSizing: "border-box" };
  const label: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 6, fontSize: 12, color: "var(--muted)", minWidth: 0 };
  const btn = (color = "var(--color-accent)", solid = false): React.CSSProperties => ({ border: `1px solid ${color}`, color: solid ? "#fff" : color, background: solid ? color : "transparent", padding: "8px 16px", borderRadius: "var(--radius-md)", font: "500 13.5px var(--font-heading)", cursor: "pointer", whiteSpace: "nowrap" });
  const mini = (color = "var(--color-text)"): React.CSSProperties => ({ border: `1px solid ${color === "var(--color-text)" ? "var(--color-divider)" : color}`, color, background: "transparent", padding: "5px 10px", borderRadius: "var(--radius-md)", font: "500 12px var(--font-heading)", cursor: "pointer", whiteSpace: "nowrap" });
  const betaTag = beta ? <span style={{ ...pill("var(--warn)"), textTransform: "uppercase", letterSpacing: ".04em", fontSize: 11 }}>Bêta</span> : null;

  const packForm = (p?: (typeof packs)[number]) => (
    <form method="post" action="/api/admin/play" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <input type="hidden" name="action" value="save" />
      {p ? <input type="hidden" name="packId" value={p.id} /> : null}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 14rem), 1fr))", gap: 12 }}>
        <label style={label}>Nom (FR)<input name="nameFr" required maxLength={60} defaultValue={p?.nameFr ?? ""} placeholder="Fluide" style={field} /></label>
        <label style={label}>Nom (EN)<input name="nameEn" maxLength={60} defaultValue={p?.nameEn ?? ""} placeholder="Smooth" style={field} /></label>
        <label style={label}>Nom court<input name="slug" maxLength={40} defaultValue={p?.slug ?? ""} placeholder="fluide" style={field} /></label>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 18rem), 1fr))", gap: 12 }}>
        <label style={label}>Description vue par les joueurs (FR)<input name="descriptionFr" maxLength={200} defaultValue={p?.descriptionFr ?? ""} placeholder="Plus d'images par seconde, même sur un petit PC." style={field} /></label>
        <label style={label}>Description (EN)<input name="descriptionEn" maxLength={200} defaultValue={p?.descriptionEn ?? ""} placeholder="More frames per second, even on a small PC." style={field} /></label>
      </div>
      <label style={label}>
        Mods inclus (depuis Modrinth) : liens ou noms courts, un par ligne
        <textarea name="projects" required rows={5} defaultValue={p ? parse<string[]>(p.modrinthProjects, []).join("\n") : ""} placeholder={"sodium\nlithium\nhttps://modrinth.com/mod/immediatelyfast"} style={{ ...field, fontFamily: "var(--font-mono, monospace)", resize: "vertical" }} />
      </label>
      <p style={{ margin: 0, fontSize: 12.5, color: "var(--muted)" }}>
        Fabric seulement. Les dépendances obligatoires (comme Fabric API) sont ajoutées toutes seules. À l&apos;enregistrement, toutes les versions de Minecraft où ces mods existent sont préparées : il faut ensuite les tester dans le launcher, puis les publier.
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="submit" style={btn("var(--color-accent)", true)}>{p ? "Enregistrer et relancer la recherche" : "Créer le pack"}</button>
      </div>
    </form>
  );

  return (
    <AdminChrome active="packsOfficiels">
      <div style={{ display: "flex", alignItems: "flex-end", gap: 16, flexWrap: "wrap", marginBottom: 16 }}>
        <div style={{ minWidth: 0, flex: "1 1 280px" }}>
          <h1 style={{ margin: "0 0 6px", fontSize: 22, fontWeight: 500, display: "flex", alignItems: "center", gap: 10 }}>Packs officiels {betaTag}</h1>
          <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>
            Les packs proposés dans « Jouer » du launcher, en plus de Vanilla. Une liste de mods Modrinth : rien n&apos;est hébergé chez nous.
          </p>
        </div>
      </div>

      {done ? <div style={banner("var(--success)")}>{done}</div> : null}
      {error ? <div style={banner("var(--danger)")}>{error}</div> : null}

      <section style={{ ...card, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", marginBottom: 16, padding: "14px 18px" }}>
        <div style={{ flex: "1 1 260px", minWidth: 0 }}>
          <p style={{ margin: 0, fontWeight: 500 }}>Badge « Bêta » du mode Jouer</p>
          <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "var(--muted)" }}>
            Un seul réglage pour le launcher (menu Jouer), le site (Mes mondes) et l&apos;admin (ce menu). {beta ? "Affiché en ce moment." : "Masqué en ce moment."}
          </p>
        </div>
        <form method="post" action="/api/admin/play">
          <input type="hidden" name="action" value="beta" />
          <input type="hidden" name="on" value={beta ? "0" : "1"} />
          <button type="submit" style={btn(beta ? "var(--color-text)" : "var(--warn)")}>{beta ? "Retirer « Bêta »" : "Remettre « Bêta »"}</button>
        </form>
      </section>

      <details style={{ ...card, marginBottom: 16 }} open={packs.length === 0}>
        <summary style={{ cursor: "pointer", fontWeight: 500 }}>+ Nouveau pack</summary>
        <div style={{ marginTop: 14 }}>{packForm()}</div>
      </details>

      {packs.length === 0 ? (
        <section style={{ ...card, textAlign: "center", borderStyle: "dashed" }}>
          <p style={{ margin: 0, fontWeight: 500 }}>Aucun pack pour le moment</p>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--muted)" }}>Les joueurs ne voient que Vanilla tant qu&apos;aucune version n&apos;est publiée.</p>
        </section>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {packs.map((p) => {
            const published = p.versions.filter((v) => Number(v.published)).length;
            const counts = Object.fromEntries(Object.keys(STATUS).map((k) => [k, p.versions.filter((v) => v.status === k).length]));
            return (
              <details key={p.id} id={`pack-${p.id}`} style={{ ...card, padding: "14px 18px" }} open={openPack === p.id}>
                <summary style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", listStyle: "none", flexWrap: "wrap" }}>
                  <span style={{ flex: "1 1 200px", minWidth: 0 }}>
                    <span style={{ display: "block", fontWeight: 600 }}>{p.nameFr}</span>
                    <span style={{ display: "block", fontSize: 12, color: "var(--muted)" }}>{p.descriptionFr || "Sans description"}</span>
                  </span>
                  <span style={pill(published ? "var(--success)" : "var(--muted)")}>{published ? `${published} version${published > 1 ? "s" : ""} publiée${published > 1 ? "s" : ""}` : "Pas publié"}</span>
                  {counts.to_test ? <span style={pill("var(--color-accent)")}>{counts.to_test} à tester</span> : null}
                  {counts.review ? <span style={pill("var(--warn)")}>{counts.review} à revoir</span> : null}
                </summary>
                <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 18 }}>
                  <div>
                    <p style={{ margin: "0 0 8px", fontSize: 11.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--muted)" }}>
                      Versions de Minecraft (créées automatiquement)
                    </p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 1, border: "1px solid var(--color-divider)", borderRadius: "var(--radius-md)", overflow: "hidden" }}>
                      {p.versions.map((v) => {
                        const st = STATUS[v.status] ?? STATUS.to_test;
                        const files = parse<FileRow[]>(v.files, []);
                        const missing = parse<{ title: string }[]>(v.missing, []);
                        const isPub = Number(v.published) === 1;
                        const hidden = (what: string) => (
                          <>
                            <input type="hidden" name="action" value="version" />
                            <input type="hidden" name="versionId" value={v.id} />
                            <input type="hidden" name="packId" value={p.id} />
                            <input type="hidden" name="what" value={what} />
                          </>
                        );
                        return (
                          <div key={v.id} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "10px 12px", background: "var(--color-surface)", borderBottom: "1px solid var(--color-divider)" }}>
                            <b style={{ minWidth: 64 }}>{v.minecraftVersion}</b>
                            <span style={pill(st.color)}>{st.label}</span>
                            {isPub ? <span style={pill("var(--success)")}>Visible par les joueurs</span> : null}
                            <span style={{ flex: "1 1 220px", minWidth: 0, fontSize: 12, color: "var(--muted)" }} title={files.map((f) => f.filename).join("\n")}>
                              {files.length} mod{files.length > 1 ? "s" : ""} · Fabric {v.loaderVersion}
                              {missing.length ? ` · sans ${missing.map((m) => m.title).join(", ")}` : ""}
                            </span>
                            {v.status !== "not_enough" ? (
                              <>
                                <form method="post" action="/api/admin/play">
                                  {hidden(v.status === "tested" ? "untested" : "tested")}
                                  <button type="submit" style={mini(v.status === "tested" ? "var(--color-text)" : "var(--success)")}>{v.status === "tested" ? "Remettre à tester" : "Marquer testée"}</button>
                                </form>
                                <form method="post" action="/api/admin/play">
                                  {hidden(isPub ? "unpublish" : "publish")}
                                  <button type="submit" style={mini(isPub ? "var(--danger)" : "var(--color-accent)")}>{isPub ? "Retirer du launcher" : "Publier"}</button>
                                </form>
                              </>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                    <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--muted)" }}>
                      Pour tester une version : publie-la, crée-la dans « Jouer » du launcher et lance-la. Si le jeu démarre bien, marque-la « Testée ». Tant que le badge « Bêta » est affiché, les joueurs savent que c&apos;est en test.
                    </p>
                  </div>
                  <div style={{ height: 1, background: "var(--color-divider)" }} />
                  {packForm(p)}
                  <form method="post" action="/api/admin/play">
                    <input type="hidden" name="action" value="delete" />
                    <input type="hidden" name="packId" value={p.id} />
                    <label style={{ display: "inline-flex", gap: 6, alignItems: "center", fontSize: 12.5, color: "var(--muted)", marginRight: 8 }}>
                      <input type="checkbox" required />
                      Je confirme
                    </label>
                    <button type="submit" style={{ ...btn("var(--danger)"), borderColor: "transparent" }}>Supprimer ce pack</button>
                  </form>
                </div>
              </details>
            );
          })}
        </div>
      )}
    </AdminChrome>
  );
}

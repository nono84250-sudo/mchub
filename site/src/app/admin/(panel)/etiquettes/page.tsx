import { AdminChrome } from "@/components/admin/AdminChrome";
import { TagRequestCard } from "@/components/admin/TagRequestCard";
import { TagCatalogList } from "@/components/admin/TagCatalogList";
import { requireAdmin } from "@/app/admin/design/guard";
import fr from "@/i18n/dictionaries/fr.json";
import { getTagCatalog, listPendingTagGroups, listRecentlyHandledTagGroups } from "@/lib/tagRequests";
import { allTags, tagName } from "@/lib/tagCatalog";
import { isCustomTagId } from "@/lib/serverPage";
import { countPublicServersByTag } from "@/lib/public-servers";

export const dynamic = "force-dynamic";
export const metadata = { title: "Étiquettes proposées — Omniscient" };

const DONE: Record<string, string> = {
  accepted: "Étiquette ajoutée à la liste.",
  merged: "Reliée à l'étiquette existante.",
  replaced: "Étiquette remplacée : les fiches affichent le nouveau nom.",
  renamed: "Nom modifié : les fiches affichent le nouveau nom.",
  removed: "Étiquette retirée de la liste et des fiches.",
  refused: "Demande refusée.",
};
const ERRORS: Record<string, string> = {
  exists: "Ce nom correspond déjà à une autre étiquette : utilise plutôt « C'est la même que… ».",
  name: "Les deux noms sont obligatoires (24 caractères maximum).",
  gone: "Cette demande a déjà été traitée.",
  generic: "L'action n'a pas abouti. Réessaie.",
};

// Demandes d'etiquettes des proprietaires (preview validee le 16/10,
// https://claude.ai/artifact/LqxLYcE8EmKzvYQKcK4CXE), regroupees par mot normalise : une decision
// s'applique a tous les serveurs qui ont demande le meme mot. Page hors maquette, meme methode
// que /admin/contact (AdminChrome + vrais formulaires). Les motifs de refus sont ceux montres au
// proprietaire (dictionnaire du site, tagRequests.reasons).
export default async function AdminTagRequests({ searchParams }: PageProps<"/admin/etiquettes">) {
  await requireAdmin();
  const params = await searchParams;
  const done = typeof params.done === "string" ? DONE[params.done] : undefined;
  const error = typeof params.error === "string" ? ERRORS[params.error] : undefined;
  // Nombre de fiches publiques par etiquette (liste en cache), montre dans « Remplacer une etiquette ».
  const [groups, handled, catalog, usage] = await Promise.all([
    listPendingTagGroups(),
    listRecentlyHandledTagGroups(),
    getTagCatalog(),
    countPublicServersByTag().catch(() => new Map<string, number>()),
  ]);
  const reasons = fr.tagRequests.reasons;
  const label = (tag: string | null) => (tag ? tagName(tag, "fr", catalog.custom) || tag : "");
  const tagOptions = allTags(catalog.custom)
    .map((id) => ({ id, label: label(id), count: usage.get(id) ?? 0 }))
    .sort((a, b) => a.label.localeCompare(b.label, "fr"));
  // Liste « Etiquettes existantes » (23/10) : les memes, avec les deux noms.
  const tagRows = tagOptions.map((o) => ({
    id: o.id,
    fr: o.label,
    en: tagName(o.id, "en", catalog.custom) || o.id,
    count: o.count,
    builtin: !isCustomTagId(o.id),
  }));
  const listFlash = params.done === "renamed" || params.done === "removed" ? done : undefined;
  const byLine = (servers: string[]) =>
    servers.length > 1 ? `${servers[0]} et ${servers.length - 1} autre${servers.length > 2 ? "s" : ""} serveur${servers.length > 2 ? "s" : ""}` : servers[0];
  const when = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });

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
  const STATUS = {
    accepted: ["Acceptée", "var(--success)"],
    merged: ["Reliée", "var(--color-accent)"],
    replaced: ["Remplacée", "var(--warn)"],
    refused: ["Refusée", "var(--danger)"],
  } as const;

  return (
    <AdminChrome active="etiquettes">
      <h1 style={{ margin: "0 0 6px", fontSize: 22, fontWeight: 500, display: "flex", alignItems: "center", gap: 10 }}>
        Étiquettes proposées
        {groups.length ? <span style={pill("var(--color-accent)")}>{groups.length}</span> : null}
      </h1>
      <p style={{ margin: "0 0 20px", fontSize: 13, color: "var(--muted)" }}>
        Les demandes identiques sont regroupées. Une décision s&apos;applique à tous les serveurs qui ont demandé le même mot.
      </p>

      {done ? <div style={banner("var(--success)")}>{done}</div> : null}
      {error ? <div style={banner("var(--danger)")}>{error}</div> : null}

      {groups.length === 0 ? (
        <section style={{ ...card, textAlign: "center", borderStyle: "dashed" }}>
          <p style={{ margin: 0, fontWeight: 500 }}>Aucune demande en attente.</p>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--muted)" }}>Tout est à jour. Les nouvelles demandes apparaîtront ici.</p>
        </section>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {groups.map((g) => (
            <TagRequestCard
              key={g.normalized}
              normalized={g.normalized}
              word={g.word}
              byLine={`${byLine(g.servers)} · ${when(g.createdAt)}`}
              requesters={g.servers.length}
              tagOptions={tagOptions}
              custom={catalog.custom}
              reasons={reasons}
            />
          ))}
        </div>
      )}

      <p style={{ margin: "16px 0 0", fontSize: 12.5, color: "var(--muted)", borderLeft: "3px solid var(--color-divider)", paddingLeft: 10 }}>
        Le mot reste privé : seuls l&apos;équipe et le propriétaire le voient. Après « C&apos;est la même que… » ou « Remplacer », ce mot trouve aussi
        l&apos;étiquette dans la recherche de l&apos;annuaire. Une étiquette acceptée, reliée ou remplacée est ajoutée à la fiche des serveurs
        demandeurs s&apos;il leur reste une place.
      </p>

      {handled.length ? (
        <section style={{ ...card, marginTop: 20 }}>
          <h2 style={{ margin: "0 0 12px", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--muted)" }}>
            Traitées récemment
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {handled.map((h) => (
              <div
                key={`${h.normalized}-${h.decidedAt}`}
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "10px 12px", border: "1px solid var(--color-divider)", borderRadius: "var(--radius-md)" }}
              >
                <div style={{ minWidth: 0 }}>
                  <span style={{ fontWeight: 600, overflowWrap: "anywhere" }}>{h.word}</span>
                  <span style={{ fontSize: 12.5, color: "var(--muted)", marginLeft: 8 }}>
                    {h.status === "refused" ? reasons[h.refuseReason ?? 0] : h.status === "merged" || h.status === "replaced" ? `→ ${label(h.resultTagId)}` : label(h.resultTagId)}
                    {" · "}
                    {when(h.decidedAt)}
                  </span>
                </div>
                <span style={pill(STATUS[h.status][1])}>{STATUS[h.status][0]}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <TagCatalogList rows={tagRows} custom={catalog.custom} flash={listFlash} />
    </AdminChrome>
  );
}

"use client";

import { useState } from "react";
import { findExistingTag, tagName, TAG_NAME_MAX, type CustomTag } from "@/lib/tagCatalog";

// Liste « Etiquettes existantes » (page /admin/etiquettes, preview validee le 23/10,
// https://claude.ai/artifact/LRmjXBxZRFqr6JJEDuJu4x) : recherche, et par ligne « Modifier » (nom
// FR/EN, meme identifiant) ou « Retirer » (des fiches, ou remplacee par une autre etiquette).
// Envoi classique vers /api/admin/tags/..., comme les autres actions du panel. Le controle des
// doublons fait ici n'est qu'un apercu : la route refait le vrai controle (avec les alias).

export type TagRow = { id: string; fr: string; en: string; count: number; builtin: boolean };

const btn = (color: string, filled = false, small = false): React.CSSProperties => ({
  border: `1px solid ${filled ? "transparent" : color}`,
  color: filled ? "var(--color-bg)" : color,
  background: filled ? color : "transparent",
  padding: small ? "5px 11px" : "7px 14px",
  borderRadius: "var(--radius-md)",
  font: `500 ${small ? 12.5 : 13.5}px var(--font-heading)`,
  cursor: "pointer",
});
const field: React.CSSProperties = {
  font: "inherit",
  fontSize: 13.5,
  color: "var(--color-text)",
  background: "var(--color-bg)",
  border: "1px solid var(--color-divider)",
  borderRadius: "var(--radius-md)",
  padding: "8px 10px",
  minWidth: 0,
};
const label: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 4, fontSize: 12.5, color: "var(--muted)", flex: "1 1 200px" };
const formBox: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 10,
  alignItems: "flex-end",
  padding: 12,
  borderRadius: "var(--radius-md)",
  background: "var(--raised)",
};
const full: React.CSSProperties = { flexBasis: "100%", margin: 0, fontSize: 12.5, color: "var(--muted)" };
const chip = (old = false): React.CSSProperties => ({
  display: "inline-flex",
  fontSize: 12.5,
  fontWeight: 500,
  padding: "3px 10px",
  borderRadius: 999,
  whiteSpace: "nowrap",
  border: `1px ${old ? "dashed" : "solid"} color-mix(in srgb, var(--color-accent) 40%, transparent)`,
  background: old ? "transparent" : "color-mix(in srgb, var(--color-accent) 18%, transparent)",
  color: old ? "var(--muted)" : "var(--color-text)",
  textDecoration: old ? "line-through" : "none",
});
const msg = (color: string): React.CSSProperties => ({
  flexBasis: "100%",
  margin: 0,
  fontSize: 12.5,
  padding: "8px 10px",
  borderRadius: "var(--radius-md)",
  border: `1px solid ${color}`,
  background: `color-mix(in srgb, ${color} 10%, transparent)`,
  color,
});
const caption: React.CSSProperties = { fontSize: 11, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--muted)" };
const choice: React.CSSProperties = {
  flexBasis: "100%",
  display: "flex",
  gap: 8,
  alignItems: "flex-start",
  fontSize: 13,
  color: "var(--color-text)",
  padding: 10,
  border: "1px solid var(--color-divider)",
  borderRadius: "var(--radius-md)",
  background: "var(--color-surface)",
  cursor: "pointer",
};
const servers = (n: number) => `${n} serveur${n > 1 ? "s" : ""} public${n > 1 ? "s" : ""}`;
const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

export function TagCatalogList({ rows, custom, flash }: { rows: TagRow[]; custom: CustomTag[]; flash?: string }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<{ id: string; mode: "edit" | "remove" } | null>(null);
  const [nameFr, setNameFr] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [action, setAction] = useState<"strip" | "swap">("strip");
  const [swapTo, setSwapTo] = useState("");
  const [sure, setSure] = useState(false);

  const start = (row: TagRow, mode: "edit" | "remove") => {
    setOpen({ id: row.id, mode });
    setNameFr(row.fr);
    setNameEn(row.en);
    setAction("strip");
    setSwapTo("");
    setSure(false);
  };
  const close = () => setOpen(null);
  const needle = norm(q.trim());
  const shown = rows.filter((r) => !needle || norm(r.fr).includes(needle) || norm(r.en).includes(needle));
  const catalog = { custom, aliases: {} };

  return (
    <section
      id="etiquettes-existantes"
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-divider)",
        borderRadius: "var(--radius-lg)",
        padding: 18,
        marginTop: 20,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--muted)" }}>
          Étiquettes existantes · {rows.length}
        </h2>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Rechercher une étiquette"
          aria-label="Rechercher une étiquette"
          style={{ ...field, maxWidth: 260, width: "100%" }}
        />
      </div>
      {flash ? (
        <p role="status" style={msg("var(--success)")}>
          {flash}
        </p>
      ) : null}
      {shown.length === 0 ? <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>Aucune étiquette ne correspond.</p> : null}

      {shown.map((row) => {
        const o = open?.id === row.id ? open.mode : null;
        const empty = !nameFr.trim() || !nameEn.trim();
        const dup = o === "edit" && !empty ? findExistingTag(nameFr, catalog, row.id) || findExistingTag(nameEn, catalog, row.id) : null;
        const same = nameFr.trim() === row.fr && nameEn.trim() === row.en;
        const editOk = !empty && !dup && !same;
        const removeOk = action === "strip" || (action === "swap" && !!swapTo);
        return (
          <div
            key={row.id}
            style={{ border: "1px solid var(--color-divider)", borderRadius: "var(--radius-md)", padding: "10px 12px", display: "flex", flexDirection: "column", gap: 10 }}
          >
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "8px 12px" }}>
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, minWidth: 0 }}>
                <span style={chip()}>{row.fr}</span>
                <span style={chip()}>{row.en}</span>
                <span
                  style={{
                    fontSize: 10.5,
                    fontWeight: 600,
                    letterSpacing: ".05em",
                    textTransform: "uppercase",
                    color: "var(--muted)",
                    border: "1px solid var(--color-divider)",
                    borderRadius: 4,
                    padding: "1px 5px",
                  }}
                >
                  {row.builtin ? "de base" : "ajoutée"}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 12, color: "var(--muted)", fontVariantNumeric: "tabular-nums" }}>{servers(row.count)}</span>
                {o ? null : (
                  <>
                    <button type="button" onClick={() => start(row, "edit")} style={btn("var(--color-accent)", false, true)}>
                      ✎ Modifier
                    </button>
                    <button type="button" onClick={() => start(row, "remove")} style={btn("var(--danger)", false, true)}>
                      Retirer
                    </button>
                  </>
                )}
              </div>
            </div>

            {o === "edit" ? (
              <form method="post" action="/api/admin/tags/rename" style={formBox}>
                <input type="hidden" name="tagId" value={row.id} />
                <p style={{ ...full, color: "var(--color-text)", fontWeight: 600 }}>Modifier le nom</p>
                <label style={label}>
                  Nom en français
                  <input name="nameFr" required maxLength={TAG_NAME_MAX} value={nameFr} onChange={(e) => setNameFr(e.target.value)} style={field} />
                </label>
                <label style={label}>
                  Nom en anglais
                  <input name="nameEn" required maxLength={TAG_NAME_MAX} value={nameEn} onChange={(e) => setNameEn(e.target.value)} style={field} />
                </label>
                <div
                  style={{
                    flexBasis: "100%",
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    gap: 10,
                    padding: 12,
                    borderRadius: "var(--radius-md)",
                    background: "var(--color-surface)",
                    border: "1px solid var(--color-divider)",
                  }}
                >
                  <span style={caption}>Avant</span>
                  <span style={chip(true)}>{row.fr}</span>
                  <span style={chip(true)}>{row.en}</span>
                  <span aria-hidden="true" style={{ color: "var(--muted)" }}>
                    →
                  </span>
                  <span style={caption}>Après</span>
                  <span style={chip()}>{nameFr.trim() || "…"}</span>
                  <span style={chip()}>{nameEn.trim() || "…"}</span>
                </div>
                {empty ? (
                  <p style={msg("var(--danger)")}>Les deux noms sont obligatoires ({TAG_NAME_MAX} caractères maximum).</p>
                ) : dup ? (
                  <p style={msg("var(--danger)")}>Ce nom existe déjà : « {tagName(dup, "fr", custom) || dup} ».</p>
                ) : same ? (
                  <p style={full}>Aucun changement.</p>
                ) : (
                  <p style={full}>
                    Les {servers(row.count)} qui l&apos;ont (et les fiches privées) affichent le nouveau nom tout de suite, sur le site et dans le launcher.
                    L&apos;ancien nom reste un mot de recherche.
                  </p>
                )}
                <div style={{ display: "flex", gap: 8, flexBasis: "100%" }}>
                  <button type="submit" disabled={!editOk} style={{ ...btn("var(--color-accent)", true), opacity: editOk ? 1 : 0.45 }}>
                    Enregistrer
                  </button>
                  <button type="button" onClick={close} style={btn("var(--muted)")}>
                    Annuler
                  </button>
                </div>
              </form>
            ) : null}

            {o === "remove" ? (
              <form method="post" action="/api/admin/tags/remove" style={formBox}>
                <input type="hidden" name="tagId" value={row.id} />
                <p style={{ ...full, color: "var(--color-text)", fontWeight: 600 }}>
                  Retirer « {row.fr} » de la liste ({servers(row.count)} l&apos;utilisent)
                </p>
                <label style={choice}>
                  <input type="radio" name="action" value="strip" checked={action === "strip"} onChange={() => (setAction("strip"), setSure(false))} />
                  <span>
                    La retirer des fiches
                    <small style={{ display: "block", color: "var(--muted)", fontSize: 12, marginTop: 2 }}>
                      Elle disparaît des fiches et des filtres. Les propriétaires peuvent en choisir une autre.
                    </small>
                  </span>
                </label>
                <label style={choice}>
                  <input type="radio" name="action" value="swap" checked={action === "swap"} onChange={() => (setAction("swap"), setSure(false))} />
                  <span>
                    La remplacer par une autre étiquette
                    <small style={{ display: "block", color: "var(--muted)", fontSize: 12, marginTop: 2 }}>
                      Les fiches reçoivent l&apos;autre étiquette (si elles ne l&apos;ont pas déjà). Chercher l&apos;ancien nom trouve la nouvelle.
                    </small>
                  </span>
                </label>
                {action === "swap" ? (
                  <label style={{ ...label, flexBasis: "100%" }}>
                    Étiquette qui la remplace
                    <select name="swapTo" required value={swapTo} onChange={(e) => (setSwapTo(e.target.value), setSure(false))} style={field}>
                      <option value="">Choisis une étiquette…</option>
                      {rows
                        .filter((r) => r.id !== row.id)
                        .map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.fr}
                          </option>
                        ))}
                    </select>
                  </label>
                ) : null}
                <p style={full}>Personne ne pourra plus la choisir. Si un joueur la propose à nouveau, elle reviendra dans les demandes.</p>
                {sure && removeOk ? (
                  <>
                    <p style={msg("var(--danger)")}>
                      <b>
                        Retirer « {row.fr} » de {row.count} fiche{row.count > 1 ? "s" : ""} publique{row.count > 1 ? "s" : ""} (et des fiches privées) ? Ce n&apos;est
                        pas annulable en un clic.
                      </b>
                    </p>
                    <div style={{ display: "flex", gap: 8, flexBasis: "100%" }}>
                      <button type="submit" style={btn("var(--danger)", true)}>
                        Oui, retirer
                      </button>
                      <button type="button" onClick={() => setSure(false)} style={btn("var(--muted)")}>
                        Annuler
                      </button>
                    </div>
                  </>
                ) : (
                  <div style={{ display: "flex", gap: 8, flexBasis: "100%" }}>
                    <button
                      type="button"
                      disabled={!removeOk}
                      onClick={() => setSure(true)}
                      style={{ ...btn("var(--danger)", true), opacity: removeOk ? 1 : 0.45 }}
                    >
                      Retirer
                    </button>
                    <button type="button" onClick={close} style={btn("var(--muted)")}>
                      Annuler
                    </button>
                  </div>
                )}
              </form>
            ) : null}
          </div>
        );
      })}
    </section>
  );
}

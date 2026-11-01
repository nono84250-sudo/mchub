"use client";

import { useState } from "react";
import { findExistingTag, tagName, TAG_NAME_MAX, type CustomTag } from "@/lib/tagCatalog";

// Carte d'un mot en attente (page /admin/etiquettes) : quatre actions, chacune ouvre son petit
// formulaire (envoi classique vers /api/admin/tag-requests/..., comme les autres actions du panel).
// 23/10 (preview https://claude.ai/artifact/LRmjXBxZRFqr6JJEDuJu4x) : « Modifier puis accepter »
// (le texte du joueur, corrige a la main, avec apercu) et « Remplacer une etiquette » (renomme une
// etiquette existante, qui garde sa place sur les fiches). Le controle des doublons fait ici n'est
// qu'un apercu (sans les alias, prives) : la route refait le vrai controle.

const btn = (color: string, filled = false): React.CSSProperties => ({
  border: `1px solid ${filled ? "transparent" : color}`,
  color: filled ? "var(--color-bg)" : color,
  background: filled ? color : "transparent",
  padding: "7px 14px",
  borderRadius: "var(--radius-md)",
  font: "500 13.5px var(--font-heading)",
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
const tool: React.CSSProperties = {
  border: "1px solid var(--color-divider)",
  background: "var(--color-surface)",
  color: "var(--muted)",
  borderRadius: 999,
  padding: "3px 10px",
  font: "inherit",
  fontSize: 12,
  cursor: "pointer",
};
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

const capFirst = (s: string) => s.trim().charAt(0).toUpperCase() + s.trim().slice(1);
const capWords = (s: string) =>
  s
    .trim()
    .split(/\s+/)
    .map((w) => (w.length > 2 ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ");
const servers = (n: number) => `${n} serveur${n > 1 ? "s" : ""} public${n > 1 ? "s" : ""}`;

export function TagRequestCard({
  normalized,
  word,
  byLine,
  requesters,
  tagOptions,
  custom,
  reasons,
}: {
  normalized: string;
  word: string;
  byLine: string;
  requesters: number;
  tagOptions: { id: string; label: string; count: number }[];
  custom: CustomTag[];
  reasons: string[];
}) {
  const raw = word.trim();
  const [open, setOpen] = useState<"accept" | "replace" | "merge" | "refuse" | null>(null);
  const [nameFr, setNameFr] = useState(raw);
  const [nameEn, setNameEn] = useState(raw);
  const [target, setTarget] = useState("");
  const [mergeId, setMergeId] = useState(tagOptions[0]?.id ?? "");
  const [sure, setSure] = useState(false);

  const close = () => {
    setOpen(null);
    setSure(false);
  };
  const cancel = (
    <button type="button" onClick={close} style={btn("var(--muted)")}>
      Annuler
    </button>
  );
  const catalog = { custom, aliases: {} };
  const name = (id: string) => tagName(id, "fr", custom) || id;

  // Doublon : le nom FR ou EN est deja celui d'une autre etiquette (celle qu'on remplace exceptee).
  const check = (exceptId?: string): { ok: boolean; box: React.ReactNode } => {
    if (!nameFr.trim() || !nameEn.trim()) {
      return { ok: false, box: <p style={msg("var(--danger)")}>Les deux noms sont obligatoires ({TAG_NAME_MAX} caractères maximum).</p> };
    }
    const dup = findExistingTag(nameFr, catalog, exceptId) || findExistingTag(nameEn, catalog, exceptId);
    if (!dup) return { ok: true, box: null };
    return {
      ok: false,
      box: (
        <p style={msg("var(--danger)")}>
          Ce nom existe déjà : « {name(dup)} ».{" "}
          <button
            type="button"
            onClick={() => {
              setMergeId(dup);
              setOpen("merge");
              setSure(false);
            }}
            style={{ border: 0, background: "none", color: "inherit", textDecoration: "underline", padding: 0, font: "inherit", fontWeight: 600, cursor: "pointer" }}
          >
            Relier à cette étiquette à la place
          </button>
        </p>
      ),
    };
  };

  const setBoth = (f: (s: string) => string) => {
    setNameFr(f(nameFr));
    setNameEn(f(nameEn));
  };
  const nameFields = (
    <>
      <label style={label}>
        Nom en français
        <input name="nameFr" required maxLength={TAG_NAME_MAX} value={nameFr} onChange={(e) => setNameFr(e.target.value)} style={field} />
      </label>
      <label style={label}>
        Nom en anglais
        <input name="nameEn" required maxLength={TAG_NAME_MAX} value={nameEn} onChange={(e) => setNameEn(e.target.value)} style={field} />
      </label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, flexBasis: "100%" }}>
        <button type="button" style={tool} onClick={() => setBoth(capFirst)}>
          Majuscule au début
        </button>
        <button type="button" style={tool} onClick={() => setBoth(capWords)}>
          Majuscule à chaque mot
        </button>
        <button type="button" style={tool} onClick={() => setBoth(() => raw)}>
          ↺ Remettre le texte du joueur
        </button>
      </div>
    </>
  );
  const chips = (
    <>
      <span style={chip()}>{nameFr.trim() || "…"}</span>
      <span style={chip()}>{nameEn.trim() || "…"}</span>
    </>
  );

  const accept = open === "accept" ? check() : null;
  const targetTag = tagOptions.find((o) => o.id === target);
  const replace = open === "replace" && targetTag ? check(targetTag.id) : null;

  return (
    <section
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-divider)",
        borderRadius: "var(--radius-lg)",
        padding: 18,
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 10 }}>
        <span style={{ fontSize: 17, fontWeight: 600, overflowWrap: "anywhere" }}>{word}</span>
        <span style={{ fontSize: 12.5, color: "var(--muted)" }}>{byLine}</span>
      </div>

      {open === null ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <button type="button" onClick={() => setOpen("accept")} style={btn("var(--success)")}>
            ✎ Modifier puis accepter
          </button>
          <button type="button" onClick={() => setOpen("replace")} style={btn("var(--warn)")}>
            ⇄ Remplacer une étiquette
          </button>
          <button type="button" onClick={() => setOpen("merge")} style={btn("var(--color-accent)")}>
            C&apos;est la même que…
          </button>
          <button type="button" onClick={() => setOpen("refuse")} style={btn("var(--danger)")}>
            Refuser
          </button>
        </div>
      ) : null}

      {open === "accept" && accept ? (
        <form method="post" action="/api/admin/tag-requests/accept" style={formBox}>
          <input type="hidden" name="normalized" value={normalized} />
          <p style={{ ...full, color: "var(--color-text)", fontWeight: 600 }}>Mets le texte à ta façon, puis accepte</p>
          <p style={full}>
            Le joueur a écrit : <b style={{ color: "var(--color-text)" }}>{word}</b>
          </p>
          {nameFields}
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, flexBasis: "100%", fontSize: 12.5, color: "var(--muted)" }}>
            Aperçu sur la fiche : {chips}
          </div>
          {accept.box}
          <div style={{ display: "flex", gap: 8, flexBasis: "100%" }}>
            <button type="submit" disabled={!accept.ok} style={{ ...btn("var(--success)", true), opacity: accept.ok ? 1 : 0.45 }}>
              Accepter
            </button>
            {cancel}
          </div>
        </form>
      ) : null}

      {open === "replace" ? (
        <form method="post" action="/api/admin/tag-requests/replace" style={formBox}>
          <input type="hidden" name="normalized" value={normalized} />
          <p style={{ ...full, color: "var(--color-text)", fontWeight: 600 }}>Remplacer une étiquette existante par celle-ci</p>
          <p style={full}>L&apos;étiquette choisie garde sa place sur toutes les fiches ; seul son nom change.</p>
          <label style={{ ...label, flexBasis: "100%" }}>
            Étiquette à remplacer
            <select
              name="tagId"
              required
              value={target}
              onChange={(e) => {
                setTarget(e.target.value);
                setSure(false);
                // Texte encore brut : on propose la majuscule, comme le reste de la liste.
                if (nameFr === raw && nameEn === raw) setBoth(capFirst);
              }}
              style={field}
            >
              <option value="">Choisis une étiquette…</option>
              {tagOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label} · {servers(o.count)}
                </option>
              ))}
            </select>
          </label>
          {targetTag && replace ? (
            <>
              {nameFields}
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
                <span style={chip(true)}>{tagName(targetTag.id, "fr", custom)}</span>
                <span style={chip(true)}>{tagName(targetTag.id, "en", custom)}</span>
                <span aria-hidden="true" style={{ color: "var(--muted)" }}>
                  →
                </span>
                <span style={caption}>Après</span>
                {chips}
              </div>
              {replace.box}
              {replace.ok ? (
                <ul style={{ flexBasis: "100%", margin: 0, paddingLeft: 18, fontSize: 12.5, display: "flex", flexDirection: "column", gap: 4 }}>
                  <li>
                    Les {servers(targetTag.count)} qui ont « {targetTag.label} » (et les fiches privées qui l&apos;ont aussi) affichent « {nameFr.trim()} » tout de
                    suite, sur le site et dans le launcher, en français et en anglais.
                  </li>
                  <li>Chercher « {targetTag.label} » dans l&apos;annuaire trouve toujours ces serveurs (l&apos;ancien nom devient un mot de recherche).</li>
                  <li>
                    {requesters > 1
                      ? `Les ${requesters} serveurs qui ont proposé ce mot reçoivent l'étiquette s'il leur reste une place.`
                      : "Le serveur qui a proposé ce mot reçoit l'étiquette s'il lui reste une place."}
                  </li>
                  <li>Aucun serveur ne perd son étiquette. Tu peux revenir en arrière en la renommant à nouveau.</li>
                </ul>
              ) : null}
              {replace.ok && sure ? (
                <p style={msg("var(--warn)")}>
                  <b>
                    Remplacer « {targetTag.label} » par « {nameFr.trim()} » ?
                  </b>
                </p>
              ) : null}
            </>
          ) : null}
          <div style={{ display: "flex", gap: 8, flexBasis: "100%" }}>
            {targetTag && replace ? (
              sure && replace.ok ? (
                <>
                  <button type="submit" style={btn("var(--warn)", true)}>
                    Oui, remplacer
                  </button>
                  <button type="button" onClick={() => setSure(false)} style={btn("var(--muted)")}>
                    Annuler
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={!replace.ok}
                    onClick={() => setSure(true)}
                    style={{ ...btn("var(--warn)", true), opacity: replace.ok ? 1 : 0.45 }}
                  >
                    Remplacer
                  </button>
                  {cancel}
                </>
              )
            ) : (
              cancel
            )}
          </div>
        </form>
      ) : null}

      {open === "merge" ? (
        <form method="post" action="/api/admin/tag-requests/merge" style={formBox}>
          <input type="hidden" name="normalized" value={normalized} />
          <label style={label}>
            Étiquette existante
            <select name="tagId" required value={mergeId} onChange={(e) => setMergeId(e.target.value)} style={field}>
              {tagOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <div style={{ display: "flex", gap: 8, flexBasis: "100%" }}>
            <button type="submit" style={btn("var(--color-accent)", true)}>
              Confirmer
            </button>
            {cancel}
          </div>
        </form>
      ) : null}

      {open === "refuse" ? (
        <form method="post" action="/api/admin/tag-requests/refuse" style={formBox}>
          <input type="hidden" name="normalized" value={normalized} />
          <label style={label}>
            Motif (visible par le propriétaire)
            <select name="reason" required style={field}>
              {reasons.map((r, i) => (
                <option key={r} value={i}>
                  {r}
                </option>
              ))}
            </select>
          </label>
          <div style={{ display: "flex", gap: 8, flexBasis: "100%" }}>
            <button type="submit" style={btn("var(--danger)", true)}>
              Refuser
            </button>
            {cancel}
          </div>
        </form>
      ) : null}
    </section>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { useDirectoryLoading } from "@/components/DirectoryLoading";
import { useRouter } from "next/navigation";
import { Funnel, MagnifyingGlass, X } from "@phosphor-icons/react";
import { TeamAvatar } from "@/components/TeamAvatar";
import { useI18n } from "@/i18n/I18nProvider";
import type { PageTag } from "@/lib/serverPage";
import { allTags, tagName, type CustomTag } from "@/lib/tagCatalog";
import {
  SERVER_SORTS,
  activeFilterKeys,
  filtersToSearch,
  withoutFilter,
  type FilterKey,
  type ServerFacets,
  type ServerListFilters,
} from "@/lib/serverFilters";

// Barre de filtres de l'annuaire (option C validee le 2026-10-16). Les filtres vivent dans
// l'URL (lien partageable, bouton retour) ; chaque changement revient a la page 1. Les
// compteurs (facets) arrivent deja calcules du serveur, sur la liste en cache.

const SORT_LABEL: Record<(typeof SERVER_SORTS)[number], string> = {
  recent: "servers.sortRecent",
  trend: "servers.sortTrend",
  players: "servers.sortPlayers",
  played: "servers.sortPlayed",
  az: "servers.sortAz",
};

// customTags : etiquettes ajoutees par l'equipe (demandes d'etiquettes), pour leurs noms.
type Props = { filters: ServerListFilters; facets: ServerFacets; total: number; customTags?: CustomTag[] };

export function ServerDirectoryFilters({ filters, facets, total, customTags = [] }: Props) {
  const { t, locale } = useI18n();
  const tagLabel = (tag: string) => tagName(tag, locale, customTags) || tag;
  const router = useRouter();
  // Transition partagee avec la liste (DirectoryLoading.tsx) : barre + cartes fantomes pendant le chargement.
  const { pending, start: startTransition } = useDirectoryLoading();
  const [q, setQ] = useState(filters.q);
  const [panelOpen, setPanelOpen] = useState(false);
  const [teamQuery, setTeamQuery] = useState("");
  const [narrow, setNarrow] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const filtersBtnRef = useRef<HTMLButtonElement>(null);

  const go = (next: ServerListFilters) => {
    startTransition(() => router.replace(`/servers${filtersToSearch(next)}`, { scroll: false }));
  };

  // Recherche en direct (sans bouton), envoyee 300 ms apres la derniere frappe.
  useEffect(() => {
    if (q === filters.q) return;
    const id = setTimeout(() => go({ ...filters, q }), 300);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  // Valeur changee ailleurs (« Tout effacer » de l'etat vide, bouton retour) : on la reprend,
  // sauf pendant la frappe pour ne pas effacer ce que le joueur tape.
  const [typing, setTyping] = useState(false);
  const [seenQ, setSeenQ] = useState(filters.q);
  if (filters.q !== seenQ) {
    setSeenQ(filters.q);
    if (!typing) setQ(filters.q);
  }

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const update = () => setNarrow(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // Panneau : Echap ferme et rend le focus au bouton ; un clic dehors ferme (grand ecran).
  useEffect(() => {
    if (!panelOpen) return;
    panelRef.current?.querySelector<HTMLElement>("button")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPanelOpen(false);
        filtersBtnRef.current?.focus();
      }
    };
    const onClick = (e: MouseEvent) => {
      if (!panelRef.current?.contains(e.target as Node) && !filtersBtnRef.current?.contains(e.target as Node)) setPanelOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [panelOpen]);

  const toggleTag = (tag: PageTag) =>
    go({ ...filters, tags: filters.tags.includes(tag) ? filters.tags.filter((x) => x !== tag) : [...filters.tags, tag] });
  const clearAll = () => go({ ...filters, type: "all", online: false, lang: "all", tags: [], version: "all", team: "" });

  // Menu allege (19/10, meme logique que le launcher, design valide par Rushi) : la barre garde
  // les tris, Tous/Vanilla/Modde et « Filtres (n) » ; En ligne, Langue, Style, Version et Team
  // passent dans le panneau. Le chiffre compte tout ce qui est coche dans le panneau.
  const panelCount =
    filters.tags.length + (filters.version !== "all" ? 1 : 0) + (filters.online ? 1 : 0) + (filters.lang !== "all" ? 1 : 0) + (filters.team ? 1 : 0);
  const teamName = (slug: string) => facets.teams.find((x) => x.slug === slug)?.name ?? slug;
  const needle = teamQuery.trim().toLowerCase();
  const shownTeams = facets.teams.filter((x) => !needle || x.name.toLowerCase().includes(needle));
  const versionLabel = (v: string) => (v === "all" ? t("servers.versionAll") : v === "other" ? t("servers.versionOther") : `${v}.x`);
  const filterLabel = (key: FilterKey) => {
    if (key === "type") return t(filters.type === "modded" ? "servers.modded" : "servers.vanilla");
    if (key === "online") return t("servers.filterOnline");
    if (key === "lang") return t(`serverPage.languages.${filters.lang}`);
    if (key === "version") return versionLabel(filters.version);
    if (key === "team") return t("servers.teamChip", { team: teamName(filters.team) });
    return tagLabel(key.slice(4));
  };
  const countText = t(total === 1 ? "servers.resultCount" : "servers.resultCountPlural", { count: total });

  const chip = (pressed: boolean, disabled = false) =>
    `inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap px-3 text-sm transition-colors ${
      pressed ? "bg-accent/15 font-medium text-foreground" : "text-foreground hover:bg-surface-raised"
    } ${disabled ? "cursor-not-allowed opacity-45" : ""}`;
  const count = (n: number) => <span className="font-mono text-[11px] text-muted tabular-nums">{n}</span>;
  const check = (on: boolean) => (on ? <span aria-hidden className="mr-0.5 inline-block h-1 w-2 -translate-y-px -rotate-45 border-b-2 border-l-2 border-accent" /> : null);

  const typeOptions = [
    ["all", "servers.filterAll"],
    ["vanilla", "servers.vanilla"],
    ["modded", "servers.modded"],
  ] as const;
  const langOptions = [
    ["all", "servers.langAll"],
    ["fr", "servers.langFr"],
    ["en", "servers.langEn"],
  ] as const;

  const panel = (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal={narrow}
      aria-labelledby="server-filters-title"
      className={
        narrow
          ? "fixed inset-x-0 bottom-0 z-50 flex max-h-[80vh] flex-col gap-4 overflow-y-auto rounded-t-2xl border border-border bg-surface p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] shadow-2xl"
          : "absolute right-0 top-full z-30 mt-2 flex w-[min(440px,calc(100vw-2rem))] flex-col gap-4 rounded-xl border border-border bg-surface p-4 shadow-2xl"
      }
    >
      <div className="flex items-center justify-between">
        <strong id="server-filters-title" className="text-[15px] font-semibold text-foreground">{t("servers.filtersTitle")}</strong>
        <button
          type="button"
          onClick={() => {
            setPanelOpen(false);
            filtersBtnRef.current?.focus();
          }}
          aria-label={t("servers.close")}
          className="grid h-9 w-9 place-items-center rounded-lg border border-border text-muted hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-[11px] uppercase tracking-wider text-muted">{t("servers.status")}</legend>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            aria-pressed={filters.online}
            aria-label={`${t("servers.filterOnline")}, ${facets.online}`}
            onClick={() => go({ ...filters, online: !filters.online })}
            className={`${chip(filters.online)} rounded-full border ${filters.online ? "border-accent" : "border-border"}`}
          >
            {check(filters.online)}
            <span aria-hidden className="h-2 w-2 rounded-full bg-success" />
            {t("servers.filterOnline")}
            {count(facets.online)}
          </button>
        </div>
      </fieldset>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-[11px] uppercase tracking-wider text-muted">{t("serverPage.editor.languages")}</legend>
        <div className="flex flex-wrap gap-1.5">
          {langOptions.map(([value, label]) => {
            const on = filters.lang === value;
            return (
              <button
                key={value}
                type="button"
                aria-pressed={on}
                aria-label={`${t(label)}, ${facets.lang[value]}`}
                onClick={() => go({ ...filters, lang: value })}
                className={`${chip(on)} rounded-full border ${on ? "border-accent" : "border-border"}`}
              >
                {check(on)}
                {t(label)}
                {count(facets.lang[value])}
              </button>
            );
          })}
        </div>
      </fieldset>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-[11px] uppercase tracking-wider text-muted">{t("servers.style")}</legend>
        <p className="text-xs text-muted">{t("servers.styleHelp")}</p>
        <div className="flex flex-wrap gap-1.5">
          {/* 30 etiquettes : on ne montre que celles qui ont des serveurs (ou deja cochees). */}
          {allTags(customTags).filter((tag) => (facets.tags[tag] ?? 0) > 0 || filters.tags.includes(tag)).map((tag) => {
            const on = filters.tags.includes(tag);
            const n = facets.tags[tag] ?? 0;
            const disabled = n === 0 && !on;
            return (
              <button
                key={tag}
                type="button"
                aria-pressed={on}
                aria-disabled={disabled || undefined}
                aria-label={`${tagLabel(tag)}, ${n}`}
                onClick={() => !disabled && toggleTag(tag)}
                className={`${chip(on, disabled)} rounded-full border ${on ? "border-accent" : "border-border"}`}
              >
                {check(on)}
                {tagLabel(tag)}
                {count(n)}
              </button>
            );
          })}
        </div>
      </fieldset>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-[11px] uppercase tracking-wider text-muted">{t("servers.version")}</legend>
        <div className="flex flex-wrap gap-1.5">
          {[{ value: "all", count: facets.type.all }, ...facets.versions].map(({ value, count: n }) => {
            const on = filters.version === value;
            const disabled = n === 0 && !on;
            return (
              <button
                key={value}
                type="button"
                aria-pressed={on}
                aria-disabled={disabled || undefined}
                aria-label={`${versionLabel(value)}, ${n}`}
                onClick={() => !disabled && go({ ...filters, version: value })}
                className={`${chip(on, disabled)} rounded-full border ${on ? "border-accent" : "border-border"}`}
              >
                {check(on)}
                {versionLabel(value)}
                {count(n)}
              </button>
            );
          })}
        </div>
      </fieldset>
      {facets.teams.length ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-[11px] uppercase tracking-wider text-muted">{t("servers.team")}</legend>
          {facets.teams.length > 5 ? (
            <label className="field-with-icon">
              <span className="sr-only">{t("servers.teamSearch")}</span>
              <MagnifyingGlass className="h-4 w-4" />
              <input
                type="search"
                value={teamQuery}
                onChange={(e) => setTeamQuery(e.target.value)}
                placeholder={t("servers.teamSearch")}
                className="field-input h-9 w-full py-0 text-sm"
              />
            </label>
          ) : null}
          <div className="flex max-h-48 flex-col gap-0.5 overflow-y-auto">
            {shownTeams.map((team) => {
              const on = filters.team === team.slug;
              const disabled = team.count === 0 && !on;
              return (
                <button
                  key={team.slug}
                  type="button"
                  aria-pressed={on}
                  aria-disabled={disabled || undefined}
                  aria-label={`${team.name}, ${team.count}`}
                  onClick={() => !disabled && go({ ...filters, team: on ? "" : team.slug })}
                  className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors ${
                    on ? "bg-accent/15 font-medium text-foreground" : "text-foreground hover:bg-surface-raised"
                  } ${disabled ? "cursor-not-allowed opacity-45" : ""}`}
                >
                  <TeamAvatar team={team} size={18} />
                  <span className="min-w-0 flex-1 truncate">{team.name}</span>
                  {count(team.count)}
                </button>
              );
            })}
            {!shownTeams.length ? <p className="px-2 py-1.5 text-xs text-muted">{t("servers.teamNone")}</p> : null}
          </div>
        </fieldset>
      ) : null}
      <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
        <button type="button" onClick={clearAll} className="text-sm text-accent underline underline-offset-4">
          {t("servers.clearAll")}
        </button>
        <button
          type="button"
          onClick={() => {
            setPanelOpen(false);
            filtersBtnRef.current?.focus();
          }}
          className="btn-secondary text-sm"
        >
          {t("servers.showResults", { count: countText })}
        </button>
      </div>
    </div>
  );

  const active = activeFilterKeys(filters);

  return (
    <div className="mt-6 flex flex-col gap-3" aria-busy={pending}>
      <div className="flex flex-wrap items-center gap-2">
        <label className="field-with-icon min-w-0 flex-[1_1_240px]">
          <span className="sr-only">{t("servers.searchPlaceholder")}</span>
          <MagnifyingGlass className="h-4 w-4" />
          <input
            id="servers-search"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onFocus={() => setTyping(true)}
            onBlur={() => setTyping(false)}
            placeholder={t("servers.searchPlaceholder")}
            className="field-input w-full"
          />
        </label>
      </div>

      {/* Design 2026-10-17, point 5 : les tris en boutons (avant : petite liste deroulante),
          le choisi surligne. Sur telephone, ils defilent sur une ligne. */}
      <div className="flex min-w-0 flex-wrap items-center gap-2.5">
        <span id="servers-sort-label" className="text-[13px] text-muted">
          {t("servers.sortLabel")}
        </span>
        <div
          role="group"
          aria-labelledby="servers-sort-label"
          className="flex max-w-full overflow-x-auto rounded-[10px] border border-border max-sm:flex-nowrap"
        >
          {SERVER_SORTS.map((s, i) => {
            const on = filters.sort === s;
            return (
              <button
                key={s}
                type="button"
                aria-pressed={on}
                onClick={() => go({ ...filters, sort: s })}
                className={`whitespace-nowrap px-3 py-[7px] text-[13px] font-medium transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent ${
                  i ? "border-l border-border" : ""
                } ${on ? "bg-accent/15 text-foreground shadow-[inset_0_-2px_0_var(--accent)]" : "text-muted hover:text-foreground"}`}
              >
                {t(SORT_LABEL[s])}
              </button>
            );
          })}
        </div>
      </div>

      <div className="relative flex flex-wrap items-center gap-2">
        <div className="-mx-1 flex max-w-full gap-2 overflow-x-auto px-1 py-0.5">
          <div role="group" aria-label={t("serverDetail.type")} className="flex shrink-0 overflow-hidden rounded-full border border-border">
            {typeOptions.map(([value, label], i) => {
              const on = filters.type === value;
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={on}
                  aria-label={`${t(label)}, ${facets.type[value]}`}
                  onClick={() => go({ ...filters, type: value })}
                  className={`${chip(on)} ${i ? "border-l border-border" : ""}`}
                >
                  {check(on)}
                  {t(label)}
                  {count(facets.type[value])}
                </button>
              );
            })}
          </div>
          <button
            ref={filtersBtnRef}
            type="button"
            aria-expanded={panelOpen}
            aria-haspopup="dialog"
            onClick={() => setPanelOpen((o) => !o)}
            className={`${chip(panelOpen)} rounded-full border ${panelCount ? "border-accent" : "border-border"}`}
          >
            <Funnel className="h-4 w-4" aria-hidden />
            {t("servers.filters")}
            {panelCount ? (
              <span className="grid h-[18px] min-w-[18px] place-items-center rounded-full bg-accent px-1 font-mono text-[11px] text-accent-foreground">{panelCount}</span>
            ) : null}
          </button>
        </div>
        {panelOpen ? (
          <>
            {narrow ? <div className="fixed inset-0 z-40 bg-black/45" onClick={() => setPanelOpen(false)} aria-hidden /> : null}
            {panel}
          </>
        ) : null}
      </div>

      {filters.type !== "all" ? <p className="text-xs text-muted">{t("servers.typeHelp")}</p> : null}
      {filters.sort === "trend" ? <p className="rounded-lg bg-surface-raised px-3 py-2 text-xs text-muted">{t("servers.trendNote")}</p> : null}

      <div className="flex min-h-7 flex-wrap items-center gap-1.5">
        <span className="mr-1 text-sm text-muted" aria-live="polite">
          {countText}
        </span>
        {active.map((key) => (
          <span key={key} className="inline-flex h-7 items-center gap-1 rounded-full border border-border bg-surface-raised pl-2.5 pr-1 text-xs text-foreground">
            {filterLabel(key)}
            <button
              type="button"
              onClick={() => go(withoutFilter(filters, key))}
              aria-label={t("servers.removeFilter", { filter: filterLabel(key) })}
              className="grid h-6 w-6 place-items-center rounded-full text-muted hover:bg-border hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        {active.length ? (
          <button type="button" onClick={clearAll} className="px-1 text-xs text-accent underline underline-offset-4">
            {t("servers.clearAll")}
          </button>
        ) : null}
      </div>
    </div>
  );
}

// Etat vide quand des filtres excluent tout : nomme le filtre qui bloque et propose de le retirer.
export function ServerFiltersEmpty({
  filters,
  blocking,
  customTags = [],
  teams = [],
}: {
  filters: ServerListFilters;
  blocking: { key: FilterKey; gain: number } | null;
  customTags?: CustomTag[];
  teams?: ServerFacets["teams"];
}) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const { start } = useDirectoryLoading();
  const go = (next: ServerListFilters) => start(() => router.replace(`/servers${filtersToSearch(next)}`, { scroll: false }));
  const label = (key: FilterKey) => {
    if (key === "type") return t(filters.type === "modded" ? "servers.modded" : "servers.vanilla");
    if (key === "online") return t("servers.filterOnline");
    if (key === "lang") return t(`serverPage.languages.${filters.lang}`);
    if (key === "version") return filters.version === "other" ? t("servers.versionOther") : `${filters.version}.x`;
    if (key === "team") return t("servers.teamChip", { team: teams.find((x) => x.slug === filters.team)?.name ?? filters.team });
    return tagName(key.slice(4), locale, customTags) || key.slice(4);
  };
  return (
    <div role="status" className="panel mt-6 flex flex-col items-center gap-3 p-8 text-center text-muted">
      <strong className="text-[15px] text-foreground">{t("servers.noneTitle")}</strong>
      {filters.q ? <span>{t("servers.emptyQuery", { query: filters.q })}</span> : null}
      {blocking ? (
        <>
          <span>{t("servers.noneHint", { filter: label(blocking.key) })}</span>
          <button type="button" className="btn-secondary text-sm" onClick={() => go(withoutFilter(filters, blocking.key))}>
            {t("servers.noneRemove", { filter: label(blocking.key) })} (+{blocking.gain})
          </button>
        </>
      ) : null}
      <button
        type="button"
        className="text-sm text-accent underline underline-offset-4"
        onClick={() => go({ ...filters, q: "", type: "all", online: false, lang: "all", tags: [], version: "all", team: "" })}
      >
        {t("servers.clearAll")}
      </button>
    </div>
  );
}

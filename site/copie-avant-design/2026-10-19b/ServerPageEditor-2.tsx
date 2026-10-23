"use client";

import { Fragment, useActionState, useEffect, useRef, useState, type CSSProperties } from "react";
import { FitHeightIconRow } from "@/components/FitHeightIconRow";
import { ArrowDown, ArrowUp, ImageSquare, Image as ImageIcon, Sparkle, X } from "@phosphor-icons/react";
import { useI18n } from "@/i18n/I18nProvider";
import { ImageDropzone } from "@/components/ImageDropzone";
import { ServerPageSections, type ServerPageLabels } from "@/components/ServerPageSections";
import { TagPicker } from "@/components/TagPicker";
import { AccentPicker } from "@/components/AccentPicker";
import { TagRequestBox } from "@/components/TagRequestBox";
import type { OwnerTagPanel } from "@/lib/tagRequests";
import { tagName, type CustomTag } from "@/lib/tagCatalog";
import type { ServerPageActionState } from "@/lib/actions/serverPage";
import { SavedToast } from "@/components/SavedToast";
import {
  PAGE_ACCENTS,
  PAGE_LANGUAGES,
  PAGE_LIMITS,
  VIDEO_EMBED_ENABLED,
  isCustomAccent,
  isValidLink,
  pageAccent,
  pageInputErrors,
  visibleSections,
  youtubeVideoId,
  type PageAccent,
  type PageEditorInput,
  type PageFieldError,
  type PageSection,
  type PageTag,
} from "@/lib/serverPage";

type ServerSummary = {
  name: string;
  description: string;
  bannerUrl: string | null;
  iconUrl: string | null;
  type: "vanilla" | "modded";
  minecraftVersion: string;
  recommendedRamGB: number | null;
  modpack: string | null;
};

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-[21px] w-9 flex-shrink-0 rounded-full p-0.5 transition-colors ${checked ? "bg-accent" : "bg-border"}`}
    >
      <span className={`block h-[17px] w-[17px] rounded-full bg-surface transition-transform ${checked ? "translate-x-[15px]" : ""}`} />
    </button>
  );
}

const LATER = (label: string) => (
  <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-px text-[10.5px] font-semibold" style={{ color: "var(--frozen)", borderColor: "color-mix(in srgb, var(--frozen) 45%, transparent)" }}>
    <Sparkle className="h-3 w-3" weight="fill" />
    {label}
  </span>
);

export function ServerPageEditor({
  action,
  initial,
  server: serverProp,
  labels,
  publicHref,
  serverId,
  customTags = [],
  tagPanel,
}: {
  action: (state: ServerPageActionState, formData: FormData) => Promise<ServerPageActionState>;
  initial: PageEditorInput;
  server: ServerSummary;
  labels: ServerPageLabels;
  // Design 2026-10-17, point 7 : lien « Voir la fiche » de la bulle apres enregistrement.
  publicHref?: string;
  // Demandes d'etiquettes (16/10) : etiquettes ajoutees par l'equipe et bloc « Il te manque une etiquette ? ».
  serverId?: string;
  customTags?: CustomTag[];
  tagPanel?: OwnerTagPanel;
}) {
  const { t, locale } = useI18n();
  const tagLabel = (tag: string) => tagName(tag, locale, customTags) || tag;
  const [state, setState] = useState<PageEditorInput>(initial);
  const [baseline, setBaseline] = useState(() => JSON.stringify(initial));
  const [openSection, setOpenSection] = useState<PageSection | null>("about");
  const [pane, setPane] = useState<"edit" | "preview">("edit");
  const [resetKey, setResetKey] = useState(0);
  const [result, formAction, pending] = useActionState(action, undefined);
  const submitted = useRef<string | null>(null);
  const aboutRef = useRef<HTMLTextAreaElement>(null);

  // Apercu : nom, description et images tels qu'ils sont en train d'etre modifies (carte Identite).
  const server = state.identity
    ? {
        ...serverProp,
        name: state.identity.name || serverProp.name,
        description: state.identity.description,
        bannerUrl: state.identity.bannerUrl || null,
        iconUrl: state.identity.iconUrl || null,
      }
    : serverProp;
  const setIdentity = (patch: Partial<NonNullable<PageEditorInput["identity"]>>) =>
    setState((s) => (s.identity ? { ...s, identity: { ...s.identity, ...patch } } : s));
  const serialized = JSON.stringify(state);
  const dirty = serialized !== baseline;
  const errors = pageInputErrors(state);
  const { config } = state;

  // Enregistrement reussi : la version envoyee devient la reference « enregistree ».
  useEffect(() => {
    if (result?.savedAt && submitted.current) setBaseline(submitted.current);
  }, [result]);

  const setConfig = (patch: Partial<PageEditorInput["config"]>) => setState((s) => ({ ...s, config: { ...s.config, ...patch } }));
  const move = (i: number, d: -1 | 1) => {
    const order = [...config.order];
    const j = i + d;
    if (j < 0 || j >= order.length) return;
    [order[i], order[j]] = [order[j], order[i]];
    setConfig({ order });
  };
  const toggleHidden = (s: PageSection) =>
    setConfig({ hidden: config.hidden.includes(s) ? config.hidden.filter((h) => h !== s) : [...config.hidden, s] });
  const format = (kind: "h" | "b" | "i" | "l") => {
    const ta = aboutRef.current;
    if (!ta) return;
    const { selectionStart: a, selectionEnd: z, value } = ta;
    const sel = value.slice(a, z) || t("serverPage.editor.fmtBold").toLowerCase();
    const lineStart = value.lastIndexOf("\n", a - 1) + 1;
    const next =
      kind === "b" ? `${value.slice(0, a)}**${sel}**${value.slice(z)}` :
      kind === "i" ? `${value.slice(0, a)}*${sel}*${value.slice(z)}` :
      `${value.slice(0, lineStart)}${kind === "h" ? "## " : "- "}${value.slice(lineStart)}`;
    setConfig({ about: next.slice(0, PAGE_LIMITS.about) });
    ta.focus();
  };

  // Etat tel qu'affiche dans l'apercu : seuls les liens valides et la video reconnue apparaissent.
  const previewConfig = {
    ...config,
    videoId: youtubeVideoId(state.videoUrl),
    youtubeUrl: config.youtubeUrl && isValidLink("youtube", config.youtubeUrl) ? config.youtubeUrl : null,
    tiktokUrl: config.tiktokUrl && isValidLink("tiktok", config.tiktokUrl) ? config.tiktokUrl : null,
    gallery: config.gallery.filter((g) => g.url),
  };
  const previewDiscord = isValidLink("discord", state.discordUrl) ? state.discordUrl : null;
  const previewWebsite = isValidLink("website", state.websiteUrl) ? state.websiteUrl : null;
  const previewAccent = pageAccent(config.accent);
  const showDescription = !config.about.trim() || config.hidden.includes("about");

  const fieldHelp = (key: PageFieldError, value: string, ok: string) =>
    value.trim() ? (
      <p className={`text-xs ${errors.includes(key) ? "text-danger" : "text-success"}`}>{errors.includes(key) ? t(`serverPage.errors.${key}`) : ok}</p>
    ) : null;
  const inputClass = (bad: boolean) =>
    `w-full min-w-0 rounded-lg border bg-background px-3 py-2 text-sm text-foreground ${bad ? "border-danger" : "border-border"}`;

  const sectionBody = (s: PageSection) => {
    switch (s) {
      case "about":
        return (
          <>
            <div className="flex flex-wrap gap-1" role="toolbar">
              {(["h", "b", "i", "l"] as const).map((k) => {
                const key = { h: "fmtHeading", b: "fmtBold", i: "fmtItalic", l: "fmtList" }[k];
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => format(k)}
                    aria-describedby={`fmt-tip-${k}`}
                    className="group relative rounded-md border border-border bg-surface-raised px-2.5 py-0.5 text-[13px]"
                  >
                    {t(`serverPage.editor.${key}`)}
                    <span
                      id={`fmt-tip-${k}`}
                      role="tooltip"
                      className="pointer-events-none absolute left-0 top-[calc(100%+6px)] z-10 w-max max-w-[240px] rounded-lg bg-foreground px-2.5 py-1.5 text-left text-xs leading-snug text-background opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
                    >
                      {t(`serverPage.editor.${key}Tip`)}
                    </span>
                  </button>
                );
              })}
            </div>
            <textarea
              ref={aboutRef}
              id="page-about"
              value={config.about}
              maxLength={PAGE_LIMITS.about}
              onChange={(e) => setConfig({ about: e.target.value })}
              rows={8}
              className={`${inputClass(false)} resize-y leading-relaxed`}
            />
            {/* Petit tableau « Tu écris → Sur la fiche » : le gras prend la couleur choisie (voir RichText). */}
            <div
              className={`grid grid-cols-[auto_auto_1fr] items-baseline gap-x-3 gap-y-1 overflow-x-auto rounded-lg bg-surface-raised px-3 py-2 text-[12.5px] ${previewAccent?.className ?? ""}`}
              style={previewAccent?.style as CSSProperties | undefined}
            >
              <span className="text-[11px] uppercase tracking-[0.06em] text-muted">{t("serverPage.editor.fmtYouType")}</span>
              <span />
              <span className="text-[11px] uppercase tracking-[0.06em] text-muted">{t("serverPage.editor.fmtOnPage")}</span>
              {(
                [
                  ["Heading", (s: string) => `## ${s}`, (s: string) => <span className="text-[14.5px] font-semibold">{s}</span>],
                  ["Bold", (s: string) => `**${s}**`, (s: string) => <strong className="font-semibold text-accent">{s}</strong>],
                  ["Italic", (s: string) => `*${s}*`, (s: string) => <em className="italic">{s}</em>],
                  ["List", (s: string) => `- ${s}`, (s: string) => <span>• {s}</span>],
                ] as const
              ).map(([name, typed, shown]) => {
                const ex = t(`serverPage.editor.fmt${name}Ex`);
                return (
                  <Fragment key={name}>
                    <code className="whitespace-nowrap font-mono text-xs text-muted">{typed(ex)}</code>
                    <span className="text-muted">→</span>
                    <span className="min-w-0">
                      {shown(ex)} <span className="text-xs text-muted">({t(`serverPage.editor.fmt${name}Note`)})</span>
                    </span>
                  </Fragment>
                );
              })}
            </div>
            <div className="flex flex-wrap justify-between gap-2 text-xs text-muted">
              <span>{t("serverPage.editor.aboutHelp")} {t("serverPage.editor.aboutEmpty")}</span>
              <span className="tabular-nums">
                {config.about.length} / {PAGE_LIMITS.about}
              </span>
            </div>
          </>
        );
      case "gallery":
        return (
          <>
            <p className="text-xs text-muted">{t("serverPage.editor.galleryHelp")}</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {Array.from({ length: PAGE_LIMITS.gallery }, (_, i) => {
                const item = config.gallery[i];
                return (
                  <div key={`${resetKey}-${i}-${item?.url ?? "empty"}`} className="flex min-w-0 flex-col gap-1.5">
                    <ImageDropzone
                      name={`gallery-${i}`}
                      field="gallery"
                      defaultValue={item?.url ?? ""}
                      label={`${t("serverPage.sections.gallery")} ${i + 1}`}
                      placeholder={t("serverPage.editor.galleryPlaceholder")}
                      icon={ImageIcon}
                      onChange={(url) => {
                        const gallery = [...config.gallery];
                        if (url) gallery[Math.min(i, gallery.length)] = { url, caption: item?.caption ?? "" };
                        else gallery.splice(i, 1);
                        setConfig({ gallery });
                      }}
                    />
                    {item ? (
                      <input
                        id={`page-caption-${i}`}
                        value={item.caption}
                        maxLength={PAGE_LIMITS.caption}
                        placeholder={t("serverPage.editor.caption")}
                        onChange={(e) => setConfig({ gallery: config.gallery.map((g, j) => (j === i ? { ...g, caption: e.target.value } : g)) })}
                        className={inputClass(false)}
                      />
                    ) : null}
                  </div>
                );
              })}
            </div>
          </>
        );
      case "video":
        return (
          <div className="flex flex-col gap-1">
            <label htmlFor="page-video" className="text-xs font-semibold text-foreground">{t("serverPage.editor.videoLabel")}</label>
            <input
              id="page-video"
              value={state.videoUrl}
              placeholder="https://www.youtube.com/watch?v=…"
              onChange={(e) => setState((s) => ({ ...s, videoUrl: e.target.value }))}
              className={inputClass(errors.includes("video"))}
            />
            {fieldHelp("video", state.videoUrl, t(VIDEO_EMBED_ENABLED ? "serverPage.editor.videoOk" : "serverPage.editor.videoOkLink"))}
            {VIDEO_EMBED_ENABLED ? (
              <>
                <label className="mt-2 flex items-center justify-between gap-3 text-sm text-foreground">
                  {t("serverPage.editor.videoAutoplay")}
                  <Switch checked={config.videoAutoplay} onChange={(v) => setConfig({ videoAutoplay: v })} label={t("serverPage.editor.videoAutoplay")} />
                </label>
                <p className="text-xs text-muted">{t("serverPage.editor.videoAutoplayHelp")}</p>
              </>
            ) : null}
          </div>
        );
      case "rules":
        return (
          <>
            <p className="text-xs text-muted">{t("serverPage.editor.rulesHelp")}</p>
            {config.rules.map((rule, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <span className="w-5 flex-shrink-0 text-right text-xs tabular-nums text-muted">{i + 1}</span>
                <input
                  id={`page-rule-${i}`}
                  value={rule}
                  maxLength={PAGE_LIMITS.ruleLength}
                  placeholder={t("serverPage.editor.rulePlaceholder")}
                  onChange={(e) => setConfig({ rules: config.rules.map((r, j) => (j === i ? e.target.value : r)) })}
                  className={inputClass(false)}
                />
                <button
                  type="button"
                  aria-label={t("serverPage.editor.removeRule")}
                  onClick={() => setConfig({ rules: config.rules.filter((_, j) => j !== i) })}
                  className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-md border border-border text-muted"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            {config.rules.length < PAGE_LIMITS.rules ? (
              <button type="button" onClick={() => setConfig({ rules: [...config.rules, ""] })} className="self-start rounded-lg border border-dashed border-border px-3 py-1 text-[13px]">
                {t("serverPage.editor.addRule")}
              </button>
            ) : null}
          </>
        );
      case "social": {
        const fields: { key: PageFieldError; label: string; value: string; placeholder: string; set: (v: string) => void }[] = [
          { key: "discord", label: t("serverPage.editor.discordLabel"), value: state.discordUrl, placeholder: "https://discord.gg/…", set: (v) => setState((s) => ({ ...s, discordUrl: v })) },
          { key: "website", label: t("serverPage.editor.websiteLabel"), value: state.websiteUrl, placeholder: "https://…", set: (v) => setState((s) => ({ ...s, websiteUrl: v })) },
          { key: "youtube", label: t("serverPage.editor.youtubeLabel"), value: config.youtubeUrl ?? "", placeholder: "https://www.youtube.com/@…", set: (v) => setConfig({ youtubeUrl: v }) },
          { key: "tiktok", label: t("serverPage.editor.tiktokLabel"), value: config.tiktokUrl ?? "", placeholder: "https://www.tiktok.com/@…", set: (v) => setConfig({ tiktokUrl: v }) },
        ];
        return fields.map((f) => (
          <div key={f.key} className="flex flex-col gap-1">
            <label htmlFor={`page-link-${f.key}`} className="text-xs font-semibold text-foreground">{f.label}</label>
            <input
              id={`page-link-${f.key}`}
              value={f.value}
              maxLength={PAGE_LIMITS.url}
              placeholder={f.placeholder}
              onChange={(e) => f.set(e.target.value)}
              className={inputClass(errors.includes(f.key))}
            />
            {fieldHelp(f.key, f.value, t("serverPage.editor.linkOk"))}
          </div>
        ));
      }
    }
  };

  const status = result?.error ? (
    <span className="text-danger">{t(`serverPage.errors.${result.error}`)}</span>
  ) : dirty ? (
    <span className="text-warn">{t("serverPage.editor.dirty")}</span>
  ) : result?.savedAt ? (
    <span className="text-success">{t("serverPage.editor.saved")}</span>
  ) : (
    <span className="text-muted">{t("serverPage.editor.clean")}</span>
  );

  return (
    <div className="max-w-none">
      <SavedToast savedAt={result?.savedAt} href={publicHref} />
      <h1 className="text-2xl font-bold text-foreground">{t("serverPage.editor.title")}</h1>
      <p className="mb-5 mt-1 text-sm text-muted">{t("serverPage.editor.lead")}</p>

      <div className="mb-4 flex border-b border-border lg:hidden" role="tablist">
        {(["edit", "preview"] as const).map((p) => (
          <button
            key={p}
            type="button"
            role="tab"
            aria-selected={pane === p}
            onClick={() => setPane(p)}
            className={`-mb-px flex-1 border-b-2 py-2.5 text-sm font-semibold ${pane === p ? "border-accent text-foreground" : "border-transparent text-muted"}`}
          >
            {t(p === "edit" ? "serverPage.editor.tabEdit" : "serverPage.editor.tabPreview")}
          </button>
        ))}
      </div>

      {/* 19/10 (choix de Rushi) : reglages en une colonne fixe, apercu sur tout le reste de la largeur. */}
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(320px,380px)_minmax(0,1fr)]">
        {/* ---- Reglages ---- */}
        <div className={`min-w-0 flex-col gap-4 ${pane === "edit" ? "flex" : "hidden lg:flex"}`}>
          {/* Identite (19/10, variante A) : nom, description, banniere, icone. Le fond reste juste
              dessous dans Apparence. Avant, ces champs etaient dans Parametres. */}
          {state.identity ? (
            <section className="panel flex flex-col gap-3 p-4">
              <h2 className="text-sm font-semibold text-foreground">{t("serverPage.editor.identity")}</h2>
              <label className="flex flex-col gap-1.5">
                <span className="field-label">{t("serverForm.name")}</span>
                <input
                  type="text"
                  value={state.identity.name}
                  onChange={(e) => setIdentity({ name: e.target.value })}
                  placeholder={t("serverForm.namePlaceholder")}
                  className="field-input"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="field-label">{t("serverForm.description")}</span>
                <textarea
                  rows={3}
                  value={state.identity.description}
                  onChange={(e) => setIdentity({ description: e.target.value })}
                  placeholder={t("serverForm.descriptionPlaceholder")}
                  className="field-input"
                />
              </label>
              <div className="grid grid-cols-[minmax(0,1fr)_96px] items-start gap-3">
                <ImageDropzone
                  key={`banner-${resetKey}`}
                  name="identityBanner"
                  field="banner"
                  defaultValue={state.identity.bannerUrl}
                  label={t("serverForm.bannerUrl")}
                  hint={t("serverForm.bannerHint")}
                  placeholder={t("serverForm.dropBanner")}
                  icon={ImageSquare}
                  onChange={(url) => setIdentity({ bannerUrl: url })}
                />
                <ImageDropzone
                  key={`icon-${resetKey}`}
                  name="identityIcon"
                  field="icon"
                  defaultValue={state.identity.iconUrl}
                  label={t("serverForm.iconUrl")}
                  hint={t("serverForm.iconHint")}
                  placeholder=""
                  icon={ImageSquare}
                  onChange={(url) => setIdentity({ iconUrl: url })}
                />
              </div>
            </section>
          ) : null}

          <section className="panel flex flex-col gap-4 p-4">
            <h2 className="text-sm font-semibold text-foreground">{t("serverPage.editor.look")}</h2>

            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold text-foreground">{t("serverPage.editor.accent")}</span>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  aria-pressed={config.accent === null}
                  title={t("serverPage.editor.accentDefault")}
                  aria-label={t("serverPage.editor.accentDefault")}
                  onClick={() => setConfig({ accent: null })}
                  className={`h-7 w-7 rounded-full border-2 border-surface ${config.accent === null ? "ring-2 ring-foreground" : "ring-1 ring-border"}`}
                  style={{ background: "var(--accent)" }}
                />
                {(Object.keys(PAGE_ACCENTS) as PageAccent[]).map((k) => (
                  <button
                    key={k}
                    type="button"
                    aria-pressed={config.accent === k}
                    title={t(`serverPage.accents.${k}`)}
                    aria-label={t(`serverPage.accents.${k}`)}
                    onClick={() => setConfig({ accent: k })}
                    className={`h-7 w-7 rounded-full border-2 border-surface ${config.accent === k ? "ring-2 ring-foreground" : "ring-1 ring-border"}`}
                    style={{ background: PAGE_ACCENTS[k] }}
                  />
                ))}
                <AccentPicker
                  value={isCustomAccent(config.accent) ? config.accent : null}
                  start={config.accent && !isCustomAccent(config.accent) ? PAGE_ACCENTS[config.accent] : "#2f78ad"}
                  onChange={(hex) => setConfig({ accent: hex })}
                />
              </div>
              <p className="text-xs text-muted">{t("serverPage.editor.accentHelp")}</p>
            </div>

            <div className="flex flex-col gap-2">
              <ImageDropzone
                key={`bg-${resetKey}`}
                name="backgroundUrl"
                field="background"
                defaultValue={state.backgroundUrl}
                label={t("serverPage.editor.wallpaper")}
                hint={t("serverPage.editor.wallpaperHelp")}
                placeholder={t("serverPage.editor.wallpaperPlaceholder")}
                icon={ImageSquare}
                onChange={(url) => setState((s) => ({ ...s, backgroundUrl: url }))}
              />
              <label className="flex items-center justify-between gap-3 text-sm text-foreground">
                {t("serverPage.editor.wallpaperFull")}
                <Switch checked={config.wallpaper} onChange={(v) => setConfig({ wallpaper: v })} label={t("serverPage.editor.wallpaperFull")} />
              </label>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-foreground">{t("serverPage.editor.tagsMain")}</span>
              <p className="text-xs text-muted">{t("serverPage.editor.tagsMainHelp")}</p>
              <TagPicker
                strong
                selected={config.tags}
                max={PAGE_LIMITS.tags}
                onChange={(tags) => setConfig({ tags, extraTags: config.extraTags.filter((x) => !tags.includes(x)) })}
                custom={customTags}
              />
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-foreground">{t("serverPage.editor.tagsExtra")}</span>
              <p className="text-xs text-muted">{t("serverPage.editor.tagsExtraHelp")}</p>
              <TagPicker
                selected={config.extraTags}
                max={PAGE_LIMITS.extraTags}
                exclude={config.tags}
                onChange={(extraTags) => setConfig({ extraTags })}
                custom={customTags}
              />
            </div>

            {serverId && tagPanel ? (
              <TagRequestBox
                serverId={serverId}
                initial={tagPanel}
                custom={customTags}
                hasTag={(tag) => config.tags.includes(tag as PageTag) || config.extraTags.includes(tag as PageTag)}
                onAdd={(tag) => {
                  const id = tag as PageTag;
                  if (config.tags.includes(id) || config.extraTags.includes(id)) return true;
                  if (config.tags.length < PAGE_LIMITS.tags) setConfig({ tags: [...config.tags, id] });
                  else if (config.extraTags.length < PAGE_LIMITS.extraTags) setConfig({ extraTags: [...config.extraTags, id] });
                  else return false;
                  return true;
                }}
              />
            ) : null}

            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold text-foreground">{t("serverPage.editor.languages")}</span>
              <div className="flex flex-wrap gap-1.5">
                {PAGE_LANGUAGES.map((lang) => {
                  const on = config.languages.includes(lang);
                  return (
                    <button
                      key={lang}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setConfig({ languages: on ? config.languages.filter((x) => x !== lang) : [...config.languages, lang] })}
                      className={`rounded-full border px-3 py-1 text-[13px] ${
                        on ? "border-transparent bg-accent text-accent-foreground" : "border-border bg-surface text-foreground"
                      }`}
                    >
                      {t(`serverPage.languages.${lang}`)}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-muted">{t("serverPage.editor.languagesHelp")}</p>
            </div>
          </section>

          {/* Message pendant l'installation (launcher, 17/10, point 6) */}
          <section className="panel flex flex-col gap-2 p-4">
            <h2 className="text-sm font-semibold text-foreground">{t("serverPage.editor.installMessage")}</h2>
            <p className="text-xs text-muted">{t("serverPage.editor.installMessageHelp")}</p>
            <textarea
              value={config.installMessage}
              maxLength={PAGE_LIMITS.installMessage}
              rows={3}
              placeholder={t("serverPage.editor.installMessagePlaceholder")}
              onChange={(e) => setConfig({ installMessage: e.target.value })}
              className={`${inputClass(false)} min-h-[72px] resize-y text-sm leading-relaxed`}
            />
            <span className="self-end text-[11px] text-muted">
              {config.installMessage.length} / {PAGE_LIMITS.installMessage}
            </span>
          </section>

          <div>
            <h2 className="text-[15px] font-semibold text-foreground">{t("serverPage.editor.sections")}</h2>
            <p className="text-xs text-muted">{t("serverPage.editor.sectionsHelp")}</p>
          </div>

          {config.order.map((s, i) => {
            const shown = !config.hidden.includes(s);
            const open = openSection === s;
            return (
              <section key={s} className="panel min-w-0">
                <div className="flex items-center gap-2 px-3 py-2.5">
                  <h3 className={`min-w-0 flex-1 truncate text-sm font-semibold ${shown ? "text-foreground" : "text-muted line-through"}`}>{labels.sections[s]}</h3>
                  <button type="button" aria-label={t("serverPage.editor.moveUp")} disabled={i === 0} onClick={() => move(i, -1)} className="grid h-7 w-7 place-items-center rounded-md border border-border disabled:opacity-35">
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" aria-label={t("serverPage.editor.moveDown")} disabled={i === config.order.length - 1} onClick={() => move(i, 1)} className="grid h-7 w-7 place-items-center rounded-md border border-border disabled:opacity-35">
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" aria-expanded={open} onClick={() => setOpenSection(open ? null : s)} className="px-1.5 text-[13px] text-accent">
                    {t(open ? "serverPage.editor.close" : "serverPage.editor.open")}
                  </button>
                  <Switch checked={shown} onChange={() => toggleHidden(s)} label={t("serverPage.editor.show", { section: labels.sections[s] })} />
                </div>
                {open ? <div className="flex flex-col gap-2.5 px-3 pb-3">{sectionBody(s)}</div> : null}
              </section>
            );
          })}

          <section className="flex flex-wrap items-center gap-2 rounded-[0.875rem] border border-dashed border-border px-3 py-2.5 text-xs text-muted">
            {LATER(t("serverPage.editor.later"))}
            <span>{t("serverPage.editor.laterItems")}</span>
          </section>

          <form
            action={formAction}
            onSubmit={() => {
              submitted.current = serialized;
            }}
            className="sticky bottom-0 z-10 -mx-1 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2.5"
          >
            <input type="hidden" name="payload" value={serialized} />
            <span className="min-w-0 flex-1 basis-40 text-[13px]">{status}</span>
            <button
              type="button"
              disabled={!dirty || pending}
              onClick={() => {
                setState(JSON.parse(baseline));
                setResetKey((k) => k + 1);
              }}
              className="rounded-lg border border-border px-3.5 py-2 text-sm disabled:opacity-50"
            >
              {t("serverPage.editor.cancel")}
            </button>
            <button type="submit" disabled={!dirty || pending || errors.length > 0} className="btn-primary rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50">
              {t(pending ? "serverPage.editor.saving" : "serverPage.editor.save")}
            </button>
          </form>
        </div>

        {/* ---- Apercu en direct ---- */}
        <div className={`min-w-0 flex-col gap-2 lg:sticky lg:top-6 ${pane === "preview" ? "flex" : "hidden lg:flex"}`}>
          <p className="flex items-center gap-2 text-xs text-muted">
            <span className="h-2 w-2 rounded-full bg-success" />
            {t("serverPage.editor.preview")}
          </p>
          <div
            className={`max-h-[calc(100vh-7rem)] overflow-y-auto rounded-xl border border-border bg-background ${previewAccent?.className ?? ""}`}
            style={{
              ...(previewAccent?.style as CSSProperties | undefined),
              ...(state.backgroundUrl && config.wallpaper
                ? {
                    backgroundImage: `linear-gradient(color-mix(in srgb, var(--background) 62%, transparent), color-mix(in srgb, var(--background) 88%, transparent)), url("${state.backgroundUrl}")`,
                    backgroundSize: "cover",
                    backgroundPosition: "center top",
                  }
                : {}),
            }}
          >
            <div className="flex flex-col gap-4 p-4">
              {/* Meme construction que la fiche reelle (ServerDetailView) : icone a cote du nom. */}
              <div>
                <div className="banner-placeholder mb-3 h-32 w-full overflow-hidden rounded-xl">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {server.bannerUrl ? <img src={server.bannerUrl} alt="" className="h-full w-full object-cover" /> : null}
                </div>
                {/* 19/10 : meme icone que la fiche, a la hauteur du texte. */}
                <FitHeightIconRow
                  className="!gap-3"
                  icon={
                    // eslint-disable-next-line @next/next/no-img-element
                    server.iconUrl ? <img src={server.iconUrl} alt="" className="h-full w-full object-cover" /> : server.name.trim().charAt(0).toUpperCase() || "?"
                  }
                >
                    <div className="truncate text-xl font-bold text-foreground">{server.name}</div>
                    {config.tags.length || config.languages.length ? (
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {config.tags.map((tag) => (
                          <span key={tag} className="tag-chip tag-chip-accent">
                            {tagLabel(tag)}
                          </span>
                        ))}
                        {config.languages.map((lang) => (
                          <span key={lang} className="tag-chip tag-chip-outline">
                            {t(`serverPage.languages.${lang}`)}
                          </span>
                        ))}
                      </div>
                    ) : null}
                </FitHeightIconRow>
              </div>

              <section className="panel p-3">
                <h2 className="mb-2 text-xs font-bold uppercase tracking-[0.07em] text-accent">{t("serverPage.infos")}</h2>
                <div className="grid grid-cols-2 gap-2">
                  <div className="stat-tile">
                    <div className="stat-label">{t("serverDetail.version")}</div>
                    <div className="stat-value">Minecraft {server.minecraftVersion}</div>
                  </div>
                  <div className="stat-tile">
                    <div className="stat-label">{t("serverDetail.type")}</div>
                    <div className="stat-value">{server.type === "modded" ? t("servers.modded") : t("servers.vanilla")}</div>
                  </div>
                  {server.recommendedRamGB ? (
                    <div className="stat-tile">
                      <div className="stat-label">{t("serverDetail.recommendedRam")}</div>
                      <div className="stat-value">
                        {server.recommendedRamGB} {t("serverDetail.ramUnit")}
                      </div>
                    </div>
                  ) : null}
                  {server.modpack ? (
                    <div className="stat-tile col-span-2">
                      <div className="stat-label">{t("serverPage.modpack")}</div>
                      <div className="stat-value break-words">{server.modpack}</div>
                    </div>
                  ) : null}
                </div>
                {config.extraTags.length ? (
                  <div className="mt-3">
                    <div className="mb-1.5 text-[11px] uppercase tracking-[0.04em] text-muted">{t("serverPage.moreTags")}</div>
                    <div className="flex flex-wrap gap-1.5">
                      {config.extraTags.map((tag) => (
                        <span key={tag} className="tag-chip">
                          {tagLabel(tag)}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
              </section>

              {showDescription ? (
                <section className="panel p-4">
                  <p className="whitespace-pre-wrap break-words text-foreground">{server.description}</p>
                </section>
              ) : null}
              {visibleSections(previewConfig, { discordUrl: previewDiscord, websiteUrl: previewWebsite }).length ? (
                <ServerPageSections config={previewConfig} discordUrl={previewDiscord} websiteUrl={previewWebsite} labels={labels} />
              ) : null}
              <p className="text-center text-xs text-muted">{t("serverPage.editor.previewJoin")}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

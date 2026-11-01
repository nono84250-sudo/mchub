"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Cube, DownloadSimple, Minus } from "@phosphor-icons/react";
import { useI18n } from "@/i18n/I18nProvider";
import { useConfirm } from "@/components/ConfirmDialog";
import { deleteVersionAction, deleteWorldAction, restoreVersionAction } from "@/lib/actions/worlds";
import type { CloudWorld, PlayOffer } from "@/lib/playWorlds";

// Page « Mes mondes » (mode Jouer, bêta, 24/10) : liste des mondes en ligne du joueur Supporter.
// Les versions d'un monde se déplient ; « Supprimer » demande d'écrire le mot (ConfirmDialog) ;
// « Restaurer » ne change rien tout de suite : le launcher l'applique au prochain lancement.
const VISIBLE_VERSIONS = 5;

function sizeFmt(bytes: number, locale: string): string {
  const fmt = (n: number, d = 1) => n.toLocaleString(locale === "fr" ? "fr-FR" : "en-US", { maximumFractionDigits: d });
  // Rien en ligne : « 0 Ko » (avant, un arrondi minimum affichait « 1 Ko » pour 0 octet).
  if (!bytes || bytes <= 0) return `0 ${locale === "fr" ? "Ko" : "KB"}`;
  // Même calcul que le launcher (sizeFmt de play.js) : 1 Go = 1 000 000 000 octets, sinon une même
  // sauvegarde n'affichait pas la même taille des deux côtés (retour de Rushi du 25/10).
  if (bytes >= 1e9) return `${fmt(bytes / 1e9)} ${locale === "fr" ? "Go" : "GB"}`;
  if (bytes >= 1e6) return `${fmt(bytes / 1e6, 0)} ${locale === "fr" ? "Mo" : "MB"}`;
  return `${fmt(Math.max(1, bytes / 1e3), 0)} ${locale === "fr" ? "Ko" : "KB"}`;
}

function dateFmt(iso: string, locale: string): string {
  return new Date(iso).toLocaleString(locale === "fr" ? "fr-FR" : "en-US", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
}

function agoFmt(iso: string, locale: string): string {
  const rtf = new Intl.RelativeTimeFormat(locale === "fr" ? "fr" : "en", { numeric: "auto" });
  const sec = (Date.parse(iso) - Date.now()) / 1000;
  if (Math.abs(sec) < 60) return rtf.format(0, "second");
  if (Math.abs(sec) < 3600) return rtf.format(Math.round(sec / 60), "minute");
  if (Math.abs(sec) < 86400) return rtf.format(Math.round(sec / 3600), "hour");
  return rtf.format(Math.round(sec / 86400), "day");
}

// Petite vignette « herbe » (même idée que le launcher) : pas d'image envoyée au site.
function GrassThumb({ seed }: { seed: string }) {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const cells = Array.from({ length: 16 }, (_, i) => ((h >> (i % 24)) + i * 7) % 5);
  const greens = ["#4f8a3a", "#5c9a43", "#467c33", "#6aa84f", "#3f7130"];
  return (
    <svg width="44" height="44" viewBox="0 0 4 4" aria-hidden className="flex-shrink-0 rounded-md" shapeRendering="crispEdges">
      {cells.map((v, i) => (
        <rect key={i} x={i % 4} y={Math.floor(i / 4)} width="1" height="1" fill={greens[v]} />
      ))}
    </svg>
  );
}

export function WorldsPanel({ worlds, usedBytes, quotaBytes, keepDays }: { worlds: CloudWorld[]; usedBytes: number; quotaBytes: number; keepDays: number }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const { confirm, dialog } = useConfirm();
  // Mondes repliés à l'arrivée (retour de Rushi du 25/10) : on déplie d'un clic.
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [all, setAll] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const pct = quotaBytes ? Math.min(100, (usedBytes / quotaBytes) * 100) : 100;
  const barColor = pct > 95 ? "var(--danger)" : pct > 80 ? "var(--state-busy)" : "var(--accent)";
  const word = t("worlds.word");

  async function run(key: string, action: () => Promise<{ ok: boolean; error?: string }>, okText: string) {
    setBusy(key);
    setMessage(null);
    try {
      const out = await action();
      setMessage(out.ok ? { text: okText, ok: true } : { text: out.error === "current" ? t("worlds.currentNo") : t("worlds.error"), ok: false });
      router.refresh();
    } catch {
      setMessage({ text: t("worlds.error"), ok: false });
    } finally {
      setBusy(null);
    }
  }

  const btn = "inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[13px] text-foreground hover:bg-surface-raised disabled:opacity-50";
  const mini = "inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-foreground hover:bg-surface-raised disabled:opacity-50";

  return (
    <div className="mt-6 flex flex-col gap-4">
      {dialog}
      <div className="panel flex flex-wrap items-center gap-4 px-4 py-3.5 text-[13px]">
        <span className="text-muted">{t("worlds.used")}</span>
        <div className="h-1.5 min-w-[200px] flex-1 overflow-hidden rounded-full bg-surface-raised">
          <i className="block h-full" style={{ width: `${pct}%`, background: barColor }} />
        </div>
        <b className="tabular-nums">
          {sizeFmt(usedBytes, locale)} {t("worlds.of")} {sizeFmt(quotaBytes, locale)}
        </b>
      </div>

      {message ? (
        <p role="status" className={`text-sm ${message.ok ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>
          {message.text}
        </p>
      ) : null}

      {worlds.length === 0 ? (
        <div className="panel flex flex-col items-center gap-2 px-6 py-10 text-center text-sm text-muted">
          <Cube className="h-7 w-7" />
          <h3 className="text-base font-semibold text-foreground">{t("worlds.emptyT")}</h3>
          <p className="max-w-[46ch]">{t("worlds.emptyD")}</p>
        </div>
      ) : (
        worlds.map((w) => {
          const isOpen = open.has(w.id);
          const shown = all.has(w.id) ? w.versions : w.versions.slice(0, VISIBLE_VERSIONS);
          return (
            <div key={w.id} className="panel p-4">
              <div className="flex flex-wrap items-center gap-3">
                <GrassThumb seed={w.worldKey} />
                <div className="min-w-0 flex-[1_1_180px]">
                  <h3 className="truncate font-semibold text-foreground">{w.name}</h3>
                  <p className="text-xs text-muted">
                    {w.packName || "Vanilla"} · {w.minecraftVersion ?? "?"}
                  </p>
                </div>
                {/* « il y a N minutes » dépend de l'heure : la minute peut changer entre le serveur et le navigateur. */}
                <span className="text-xs text-[var(--success)]" suppressHydrationWarning>{t("worlds.synced", { t: agoFmt(w.updatedAt, locale) })}</span>
                <span className="text-xs tabular-nums text-muted">{t("worlds.zipSize", { s: sizeFmt(w.sizeBytes, locale) })}</span>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={btn}
                    aria-expanded={isOpen}
                    onClick={() =>
                      setOpen((s) => {
                        const n = new Set(s);
                        if (n.has(w.id)) n.delete(w.id);
                        else n.add(w.id);
                        return n;
                      })
                    }
                  >
                    {isOpen ? t("worlds.hideVersions") : t("worlds.versions", { n: w.versions.length })}
                  </button>
                  <a className={btn} href={`/api/me/worlds/download?v=${encodeURIComponent(w.headVersionId ?? w.versions[0].id)}`}>
                    <DownloadSimple className="h-3.5 w-3.5" />
                    {t("worlds.dl")}
                  </a>
                  <button
                    type="button"
                    className={`${btn} text-[var(--danger)]`}
                    disabled={busy !== null}
                    onClick={async () => {
                      const ok = await confirm({
                        title: t("worlds.delWT", { w: w.name }),
                        body: t("worlds.delWD", { n: w.versions.length }),
                        confirmLabel: t("worlds.delOk"),
                        tone: "danger",
                        typeToConfirm: word,
                      });
                      if (ok) run(`w:${w.id}`, () => deleteWorldAction(w.id), t("worlds.delWToast", { w: w.name }));
                    }}
                  >
                    {t("worlds.delete")}
                  </button>
                </div>
              </div>
              {w.restorePending ? <p className="mt-2 text-xs text-[var(--state-busy)]">☁ {t("worlds.restoreAsked")}</p> : null}
              {w.split ? <p className="mt-2 text-xs text-[var(--state-busy)]">⚠ {t("worlds.split")}</p> : null}
              {isOpen ? (
                <div className="mt-3 rounded-lg border border-border">
                  <p className="border-b border-border px-3 py-2 text-xs text-muted">{t("worlds.versionsHead", { d: keepDays })}</p>
                  {shown.map((v) => {
                    // Plusieurs PC : la version à continuer (pas forcément la plus récente) et, s'il y a deux
                    // versions, l'autre ; aucune des deux ne se supprime ni ne se restaure d'ici.
                    const current = v.id === (w.headVersionId ?? w.versions[0]?.id);
                    const other = w.split?.versionId === v.id;
                    const pending = w.restoreVersionId === v.id;
                    const reason = t(`worlds.reason.${v.reason ?? "auto"}`);
                    return (
                      <div key={v.id} className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2 text-[13px] last:border-b-0">
                        <span className={`h-2 w-2 flex-shrink-0 rounded-full ${current ? "bg-[var(--success)]" : "bg-border"}`} />
                        <span className="min-w-0 flex-[1_1_200px]">
                          <b className="font-medium">{dateFmt(v.createdAt, locale)}</b> · {v.label ? `« ${v.label} »` : reason.startsWith("worlds.") ? v.reason : reason}
                          {v.deviceName ? <small className="text-muted"> · {t("worlds.fromDevice", { d: v.deviceName })}</small> : null}
                          {current ? <small className="text-[var(--success)]"> · {t("worlds.current")}</small> : null}
                          {other ? <small className="text-[var(--state-busy)]"> · {t("worlds.splitOther")}</small> : null}
                          {pending ? <small className="text-[var(--state-busy)]"> · {t("worlds.restoreAsked")}</small> : null}
                        </span>
                        <span className="text-xs tabular-nums text-muted">{sizeFmt(v.sizeBytes, locale)}</span>
                        <span className="flex gap-1.5">
                          <a className={mini} href={`/api/me/worlds/download?v=${encodeURIComponent(v.id)}`}>
                            <DownloadSimple className="h-3 w-3" />
                            {t("worlds.zip")}
                          </a>
                          {current || other ? null : (
                            <>
                              <button
                                type="button"
                                className={`${mini} border-accent text-accent`}
                                disabled={busy !== null || pending}
                                onClick={async () => {
                                  const d = dateFmt(v.createdAt, locale);
                                  const ok = await confirm({ title: t("worlds.restoreT", { w: w.name, d }), body: t("worlds.restoreD"), confirmLabel: t("worlds.restoreOk"), tone: "ok" });
                                  if (ok) run(`r:${v.id}`, () => restoreVersionAction(v.id), t("worlds.restoreToast", { w: w.name }));
                                }}
                              >
                                {t("worlds.restore")}
                              </button>
                              <button
                                type="button"
                                className={`${mini} text-[var(--danger)]`}
                                disabled={busy !== null}
                                onClick={async () => {
                                  const ok = await confirm({
                                    title: t("worlds.delVT", { d: dateFmt(v.createdAt, locale) }),
                                    body: t("worlds.delVD", { w: w.name }),
                                    confirmLabel: t("worlds.delOk"),
                                    tone: "danger",
                                    typeToConfirm: word,
                                  });
                                  if (ok) run(`v:${v.id}`, () => deleteVersionAction(v.id), t("worlds.delVToast"));
                                }}
                              >
                                {t("worlds.delete")}
                              </button>
                            </>
                          )}
                        </span>
                      </div>
                    );
                  })}
                  {w.versions.length > VISIBLE_VERSIONS && !all.has(w.id) ? (
                    <button type="button" className="w-full px-3 py-2 text-left text-xs text-accent" onClick={() => setAll((s) => new Set(s).add(w.id))}>
                      + {w.versions.length - VISIBLE_VERSIONS} · {locale === "fr" ? "Tout voir" : "See all"}
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="panel p-4 text-[13px]">
          <h2 className="mb-2 font-semibold text-foreground">{t("worlds.syncT")}</h2>
          <ul className="flex flex-col gap-1.5 text-muted">
            {["syncYes1", "syncYes2", "syncYes3"].map((k) => (
              <li key={k} className="flex gap-2">
                <Check className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-[var(--success)]" />
                {t(`worlds.${k}`)}
              </li>
            ))}
            <li className="flex gap-2">
              <Minus className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
              {t("worlds.syncNo")}
            </li>
          </ul>
        </div>
        <div className="panel p-4 text-[13px]">
          <h2 className="mb-2 font-semibold text-foreground">{t("worlds.missT")}</h2>
          <p className="text-muted">{t("worlds.missD")}</p>
        </div>
      </div>
    </div>
  );
}

// Joueur sans sauvegarde en ligne : ce que Supporter ajoute. Bouton inactif tant que le paiement
// n'existe pas (décision du 24/10) ; quota et prix lus dans l'offre.
export function WorldsPlans({ supporter, locale }: { supporter: PlayOffer | null; locale: string }) {
  const { t } = useI18n();
  const [soon, setSoon] = useState(false);
  const price = supporter ? (supporter.priceCents / 100).toLocaleString(locale === "fr" ? "fr-FR" : "en-US", { style: "currency", currency: "EUR" }) : "";
  const quota = supporter ? sizeFmt(supporter.quotaBytes, locale) : "";
  const rows: [string, boolean][] = [
    [t("worlds.row1"), true],
    [t("worlds.row2"), true],
    [t("worlds.row3", { q: quota }), false],
    [t("worlds.row4"), false],
    [t("worlds.row5"), false],
    [t("worlds.row6"), false],
  ];
  return (
    <div className="mt-6 flex flex-col gap-4">
      <div className="panel relative overflow-hidden px-6 py-10 text-center">
        <div className="pointer-events-none absolute inset-0 flex flex-col gap-3 p-4 opacity-30 blur-[2px]" aria-hidden>
          <div className="h-14 rounded-lg bg-surface-raised" />
          <div className="h-14 rounded-lg bg-surface-raised" />
          <div className="h-14 rounded-lg bg-surface-raised" />
        </div>
        <div className="relative flex flex-col items-center gap-2 text-sm text-muted">
          <Cube className="h-7 w-7" />
          <h3 className="text-base font-semibold text-foreground">{t("worlds.lockT")}</h3>
          <p className="max-w-[46ch]">{t("worlds.lockD")}</p>
        </div>
      </div>
      {supporter ? (
        <div className="panel p-5">
          <h2 className="mb-3 text-lg font-semibold text-foreground">{t("worlds.plansT")}</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left">
                  <th />
                  <th className="px-3 py-2 text-center font-semibold">
                    {locale === "fr" ? "Gratuit" : "Free"}
                    <small className="block font-normal text-muted">0 €</small>
                  </th>
                  <th className="px-3 py-2 text-center font-semibold text-[var(--state-busy)]">
                    ★ {supporter.name[locale === "fr" ? "fr" : "en"]}
                    <small className="block font-normal text-muted">{t("worlds.perMonth", { p: price })}</small>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map(([label, free]) => (
                  <tr key={label} className="border-t border-border">
                    <td className="py-2 pr-3 text-muted">{label}</td>
                    <td className="px-3 py-2 text-center">{free ? <Check className="mx-auto h-4 w-4 text-[var(--success)]" /> : "–"}</td>
                    <td className="px-3 py-2 text-center">
                      <Check className="mx-auto h-4 w-4 text-[var(--success)]" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <p className="flex-1 text-xs text-muted">
              {t("worlds.note")}
              <br />
              {t("worlds.fair")}
            </p>
            <button type="button" className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white" aria-disabled="true" onClick={() => setSoon(true)}>
              {t("worlds.cta")}
            </button>
          </div>
          {soon ? (
            <p role="status" className="mt-2 text-xs text-[var(--state-busy)]">
              {t("worlds.ctaSoon")}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

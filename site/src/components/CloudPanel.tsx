"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { CaretDown, Check, Cube, Eye, Gear, LinkSimple, Lock, Minus, Package, Trash, X } from "@phosphor-icons/react";
import { useI18n } from "@/i18n/I18nProvider";
import { useConfirm } from "@/components/ConfirmDialog";
import type { Dictionary } from "@/i18n/getDictionary";
import type { CloudPack, CloudUsage } from "@/lib/cloudPacks";
import { deleteCloudPackAction, linkCloudPackAction, unlinkCloudPackAction } from "@/lib/actions/cloud";

// Page « Mon cloud » (03/11, preview v2 validée par Rushi). Un modpack se crée et se met à jour dans
// le launcher (Jouer › une version › ⚙ › « Envoyer dans le cloud », retour de Rushi du 03/11) : ici on
// le voit, on le relie à un serveur et on le supprime (actions de lib/actions/cloud.ts).
type L = Dictionary["cloud"];
type OfferLite = { id: string; cloud: boolean; quotaBytes: number; priceCents: number; keepDays: number; packServers: number };
type ServerLite = { id: string; name: string; slug: string; minecraftVersion: string; type: string };
const LOADERS = [
  ["fabric", "Fabric"],
  ["neoforge", "NeoForge"],
  ["forge", "Forge"],
  ["quilt", "Quilt"],
] as const;
const loaderName = (l: string) => LOADERS.find(([id]) => id === l)?.[1] ?? l;

function fmt(text: string, params: Record<string, string | number> = {}): string {
  return Object.entries(params).reduce((s, [k, v]) => s.replace(`{${k}}`, String(v)), text);
}

function sizeFmt(bytes: number, locale: string): string {
  const n = (x: number, d = 1) => x.toLocaleString(locale === "fr" ? "fr-FR" : "en-US", { maximumFractionDigits: d });
  if (!bytes || bytes <= 0) return `0 ${locale === "fr" ? "Ko" : "KB"}`;
  if (bytes >= 1e9) return `${n(bytes / 1e9)} ${locale === "fr" ? "Go" : "GB"}`;
  if (bytes >= 1e6) return `${n(bytes / 1e6, 0)} ${locale === "fr" ? "Mo" : "MB"}`;
  return `${n(Math.max(1, bytes / 1e3), 0)} ${locale === "fr" ? "Ko" : "KB"}`;
}

function agoFmt(iso: string, locale: string): string {
  const rtf = new Intl.RelativeTimeFormat(locale === "fr" ? "fr" : "en", { numeric: "auto" });
  const sec = (Date.parse(iso) - Date.now()) / 1000;
  if (Math.abs(sec) < 60) return rtf.format(0, "second");
  if (Math.abs(sec) < 3600) return rtf.format(Math.round(sec / 60), "minute");
  if (Math.abs(sec) < 86400) return rtf.format(Math.round(sec / 3600), "hour");
  return rtf.format(Math.round(sec / 86400), "day");
}

const btn = "inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[13px] text-foreground hover:bg-surface-raised disabled:opacity-50";
const btnFill = "inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-3 py-1.5 text-[13px] font-semibold text-[var(--accent-foreground,#fff)] hover:opacity-90 disabled:opacity-50";
const btnDanger = "inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[13px] text-[var(--danger)] hover:bg-surface-raised disabled:opacity-50";

function Modal({ title, onClose, children, footer }: { title: string; onClose: () => void; children: ReactNode; footer: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={title} className="panel flex max-h-[90vh] w-full max-w-[560px] flex-col gap-4 overflow-y-auto p-5">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          <button type="button" className="rounded-md p-1 text-muted hover:text-foreground" onClick={onClose} aria-label="×">
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
        <div className="flex flex-wrap justify-end gap-2">{footer}</div>
      </div>
    </div>
  );
}

// --- Relier à un serveur -----------------------------------------------------------------------
function LinkDialog({ L, pack, servers, limit, onClose, onDone }: { L: L; pack: CloudPack; servers: ServerLite[]; limit: number; onClose: () => void; onDone: (text: string) => void }) {
  const [serverId, setServerId] = useState(pack.serverId ?? servers[0]?.id ?? "");
  const [mode, setMode] = useState<"required" | "suggested">(pack.linkMode ?? "required");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const server = servers.find((s) => s.id === serverId);

  async function save() {
    if (!serverId) return;
    setBusy(true);
    setError(null);
    try {
      const r = await linkCloudPackAction(pack.id, serverId, mode);
      if (r.ok) onDone(fmt(L.linkedOk, { p: pack.name, s: server?.name ?? "" }));
      else setError(r.error === "limit" ? fmt(L.limitLink, { n: r.limit ?? limit }) : L.error);
    } catch {
      setError(L.error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={fmt(L.linkT, { p: pack.name })}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={btn} onClick={onClose}>
            {L.cancel}
          </button>
          <button type="button" className={btnFill} onClick={save} disabled={busy || !serverId}>
            {L.confirm}
          </button>
        </>
      }
    >
      <p className="text-sm text-muted">{L.linkD}</p>
      {servers.length ? (
        <div className="flex flex-col gap-1.5" role="radiogroup">
          {servers.map((s) => (
            <label key={s.id} className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm ${serverId === s.id ? "border-[var(--accent)]" : "border-border"}`}>
              <input type="radio" name="srv" checked={serverId === s.id} onChange={() => setServerId(s.id)} />
              <span className="flex-1 font-medium text-foreground">{s.name}</span>
              <span className="text-xs text-muted">{s.minecraftVersion}</span>
            </label>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted">{L.noServer}</p>
      )}
      {server && server.minecraftVersion !== pack.minecraftVersion ? <p className="text-xs text-[var(--state-busy)]">{fmt(L.verWarn, { s: server.minecraftVersion, p: pack.minecraftVersion })}</p> : null}
      <div className="grid gap-2 sm:grid-cols-2" role="radiogroup">
        {(
          [
            ["required", L.req, L.reqD],
            ["suggested", L.sug, L.sugD],
          ] as const
        ).map(([id, title, desc]) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={mode === id}
            onClick={() => setMode(id)}
            className={`flex flex-col gap-1 rounded-lg border p-3 text-left ${mode === id ? "border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_8%,transparent)]" : "border-border"}`}
          >
            <span className="text-sm font-semibold text-foreground">{title}</span>
            <span className="text-xs text-muted">{desc}</span>
          </button>
        ))}
      </div>
      {error ? (
        <p role="alert" className="text-sm text-[var(--danger)]">
          {error}
        </p>
      ) : null}
    </Modal>
  );
}

// --- Ce que voit un joueur ---------------------------------------------------------------------
function PlayerPreview({ L, pack, onClose }: { L: L; pack: CloudPack; onClose: () => void }) {
  return (
    <Modal
      title={L.playerT}
      onClose={onClose}
      footer={
        <button type="button" className={btn} onClick={onClose}>
          {L.close}
        </button>
      }
    >
      <div className="rounded-lg border border-border p-4">
        <p className="text-xs uppercase tracking-wide text-muted">{pack.serverName}</p>
        <h3 className="mt-1 font-semibold text-foreground">{pack.name}</h3>
        <p className="text-xs text-muted">
          {pack.minecraftVersion} · {loaderName(pack.loader)} · {fmt(L.mods, { n: pack.files.length })}
        </p>
        <p className="mt-2 text-sm text-muted">{pack.linkMode === "required" ? L.playerReq : L.playerSug}</p>
        <span className={`${btnFill} mt-3 cursor-default`}>
          <Package className="h-4 w-4" />
          {L.installBtn}
        </span>
      </div>
    </Modal>
  );
}

// --- Page ----------------------------------------------------------------------------------------
export function CloudPanel(props: {
  L: L;
  beta: boolean;
  showPacks: boolean;
  showWorlds: boolean;
  initialTab: "packs" | "worlds";
  offer: { id: string; cloud: boolean; packServers: number; keepDays: number };
  offers: OfferLite[];
  usage: CloudUsage;
  packs: CloudPack[];
  servers: ServerLite[];
  worldsSlot: ReactNode;
}) {
  const { L, offer, usage, packs, servers } = props;
  const { locale } = useI18n();
  const router = useRouter();
  const { confirm, dialog } = useConfirm();
  const [tab, setTab] = useState(props.initialTab);
  const [plansOpen, setPlansOpen] = useState(false);
  const [cmpOpen, setCmpOpen] = useState(false);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [linking, setLinking] = useState<CloudPack | null>(null);
  const [preview, setPreview] = useState<CloudPack | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  const pct = usage.quota ? Math.min(100, (usage.total / usage.quota) * 100) : 100;
  const planLabel = offer.id === "creator" ? L.cre : offer.cloud ? L.sup : L.free;
  const say = (text: string, ok = true) => setMessage({ text, ok });
  const done = (text: string) => {
    setLinking(null);
    say(text);
    router.refresh();
  };

  async function run(key: string, action: () => Promise<boolean>, okText: string) {
    setBusy(key);
    setMessage(null);
    try {
      const ok = await action();
      say(ok ? okText : L.error, ok);
      router.refresh();
    } catch {
      say(L.error, false);
    } finally {
      setBusy(null);
    }
  }



  const tabs: { id: "packs" | "worlds"; label: string; count: number | null }[] = [
    ...(props.showPacks ? [{ id: "packs" as const, label: L.tabPacks, count: packs.length }] : []),
    ...(props.showWorlds ? [{ id: "worlds" as const, label: L.tabWorlds, count: null }] : []),
  ];

  // Offres affichées : Gratuit, Supporter, Créateur (prix « à définir » tant qu'il vaut 0).
  const offerCards = (["free", "supporter", "creator"] as const).map((id) => {
    const o = props.offers.find((x) => x.id === id);
    const title = id === "free" ? L.free : id === "supporter" ? L.sup : L.cre;
    const list = id === "free" ? L.pf : id === "supporter" ? L.ps : L.pc;
    const price = id === "free" ? "0 €" : o?.priceCents ? fmt(L.perMonth, { p: (o.priceCents / 100).toLocaleString(locale === "fr" ? "fr-FR" : "en-US", { style: "currency", currency: "EUR" }) }) : L.price;
    return { id, o, title, list, price };
  });
  const cmpCell = (id: "free" | "supporter" | "creator", row: number): string => {
    const o = props.offers.find((x) => x.id === id);
    const yes = "✓";
    const no = "–";
    const cloud = id !== "free";
    const servers = !o ? "?" : o.packServers === 0 ? L.unlimited : o.packServers === 1 ? L.servers1 : fmt(L.serversN, { n: o.packServers });
    return [yes, yes, o ? sizeFmt(o.quotaBytes, locale) : "?", yes, servers, cloud ? yes : no, cloud ? yes : no, cloud ? yes : no, cloud && o ? fmt(L.days, { n: o.keepDays }) : no, id === "creator" ? yes : no, id === "creator" ? yes : no][row] ?? no;
  };

  return (
    <div>
      {dialog}
      <h1 className="text-2xl font-bold tracking-tight text-foreground">
        {L.title}
        {props.beta ? (
          <span className="ml-2 inline-block rounded-full bg-[color-mix(in_srgb,var(--state-busy)_18%,transparent)] px-2 py-0.5 align-middle text-[11px] font-bold uppercase tracking-wide text-[var(--state-busy)]">{L.beta}</span>
        ) : null}
        <span className="ml-2 inline-block rounded-full bg-[color-mix(in_srgb,var(--accent)_14%,transparent)] px-2 py-0.5 align-middle text-xs font-semibold text-[var(--accent)]">{planLabel}</span>
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">{L.lead}</p>

      {/* Place utilisée */}
      <div className="panel mt-6 flex flex-col gap-2 px-4 py-3.5 text-[13px]">
        <div className="flex flex-wrap items-center gap-4">
          <span className="text-muted">{L.used}</span>
          <div className="flex h-2 min-w-[200px] flex-1 overflow-hidden rounded-full bg-surface-raised" aria-hidden>
            <i className="block h-full bg-[var(--accent)]" style={{ width: `${usage.quota ? (usage.packs / usage.quota) * 100 : 0}%` }} />
            {offer.cloud ? <i className="block h-full bg-[var(--success)]" style={{ width: `${usage.quota ? (usage.worlds / usage.quota) * 100 : 0}%` }} /> : null}
          </div>
          <b className="tabular-nums">
            {sizeFmt(usage.total, locale)} {L.of} {sizeFmt(usage.quota, locale)}
          </b>
        </div>
        <div className="flex flex-wrap gap-4 text-xs text-muted">
          <span>
            <i className="mr-1 inline-block h-2 w-2 rounded-full bg-[var(--accent)]" />
            {L.lgPack} · {sizeFmt(usage.packs, locale)}
          </span>
          {offer.cloud ? (
            <span>
              <i className="mr-1 inline-block h-2 w-2 rounded-full bg-[var(--success)]" />
              {L.lgWorld} · {sizeFmt(usage.worlds, locale)}
            </span>
          ) : null}
          <span>
            {L.lgFree} · {sizeFmt(Math.max(0, usage.quota - usage.total), locale)}
          </span>
        </div>
        {pct > 80 ? <p className={`text-xs ${pct > 95 ? "text-[var(--danger)]" : "text-[var(--state-busy)]"}`}>{L.almost}</p> : null}
      </div>

      {/* Onglets */}
      {tabs.length > 1 ? (
        <div className="mt-5 flex gap-1 border-b border-border" role="tablist">
          {tabs.map((tb) => (
            <button
              key={tb.id}
              type="button"
              role="tab"
              aria-selected={tab === tb.id}
              onClick={() => setTab(tb.id)}
              className={`-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm ${tab === tb.id ? "border-[var(--accent)] font-semibold text-foreground" : "border-transparent text-muted hover:text-foreground"}`}
            >
              {tb.id === "packs" ? <Package className="h-4 w-4" /> : <Cube className="h-4 w-4" />}
              {tb.label}
              {tb.id === "worlds" && !offer.cloud ? <Lock className="h-3.5 w-3.5" /> : tb.count !== null ? <span className="rounded-full bg-surface-raised px-1.5 text-[11px]">{tb.count}</span> : null}
            </button>
          ))}
        </div>
      ) : null}

      {message ? (
        <p role="status" className={`mt-4 text-sm ${message.ok ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>
          {message.text}
        </p>
      ) : null}

      {tab === "packs" && props.showPacks ? (
        <div className="mt-4 flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-xl text-sm text-muted">{L.packsLead}</p>
          </div>
          {!packs.length ? (
            <div className="panel flex flex-col items-center gap-2 px-6 py-10 text-center text-sm text-muted">
              <Package className="h-7 w-7" />
              <h3 className="text-base font-semibold text-foreground">{L.emptyPackT}</h3>
              <p className="max-w-[46ch]">{L.emptyPackD}</p>
              <p className="mt-1 rounded-md border border-border px-3 py-2 text-xs text-foreground">{L.howLauncher}</p>
            </div>
          ) : (
            packs.map((p) => {
              const isOpen = open.has(p.id);
              const mods = p.files.filter((f) => !f.path || f.path.startsWith("mods/"));
              const meta = [`${p.minecraftVersion} · ${loaderName(p.loader)}`, fmt(L.mods, { n: mods.length }), p.configCount ? fmt(L.configs, { n: p.configCount }) : L.noConfigs, sizeFmt(p.sizeBytes, locale)].join(" · ");
              return (
                <div key={p.id} className="panel p-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-md bg-[color-mix(in_srgb,var(--accent)_22%,transparent)] text-[var(--accent)]">
                      <Package className="h-6 w-6" />
                    </div>
                    <div className="min-w-0 flex-[1_1_220px]">
                      <h3 className="truncate font-semibold text-foreground">{p.name}</h3>
                      <p className="text-xs text-muted">{meta}</p>
                      <p className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                        {p.serverId ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[color-mix(in_srgb,var(--accent)_14%,transparent)] px-2 py-0.5 text-[var(--accent)]">
                            <LinkSimple className="h-3 w-3" />
                            {fmt(L.linkedTo, { s: p.serverName ?? "?" })} · {p.linkMode === "required" ? L.required : L.suggested}
                          </span>
                        ) : null}
                        {offer.id === "creator" && p.serverId ? <span className="text-muted">{fmt(L.installs, { n: p.installCount })} ·</span> : null}
                        <span className="text-muted" suppressHydrationWarning>
                          {fmt(L.updated, { t: agoFmt(p.updatedAt, locale) })}
                        </span>
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {p.serverId ? (
                        <>
                          <button type="button" className={btn} onClick={() => setPreview(p)}>
                            <Eye className="h-3.5 w-3.5" />
                            {L.asPlayer}
                          </button>
                          <button type="button" className={btn} disabled={busy === `u:${p.id}`} onClick={() => run(`u:${p.id}`, () => unlinkCloudPackAction(p.id), L.unlinkedOk)}>
                            {L.unlink}
                          </button>
                        </>
                      ) : (
                        <button type="button" className={btn} onClick={() => setLinking(p)}>
                          <LinkSimple className="h-3.5 w-3.5" />
                          {L.link}
                        </button>
                      )}
                      <button
                        type="button"
                        className={btn}
                        aria-expanded={isOpen}
                        onClick={() =>
                          setOpen((s) => {
                            const n = new Set(s);
                            if (n.has(p.id)) n.delete(p.id);
                            else n.add(p.id);
                            return n;
                          })
                        }
                      >
                        {isOpen ? L.hide : L.content}
                      </button>
                      <button
                        type="button"
                        className={btnDanger}
                        disabled={busy === `d:${p.id}`}
                        onClick={async () => {
                          const ok = await confirm({ title: fmt(L.delPT, { p: p.name }), body: L.delPD, confirmLabel: L.del, tone: "danger" });
                          if (ok) run(`d:${p.id}`, () => deleteCloudPackAction(p.id), L.deleted);
                        }}
                      >
                        <Trash className="h-3.5 w-3.5" />
                        {L.del}
                      </button>
                    </div>
                  </div>
                  {isOpen ? (
                    <div className="mt-3 flex flex-col gap-1.5 border-t border-border pt-3 text-[13px]">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{fmt(L.mods, { n: mods.length })}</p>
                      {p.files.map((f) => {
                        const kind = f.source === "cf" ? ["CurseForge", "var(--state-busy)"] : f.source === "custom" ? [f.pending ? L.srcPending : L.srcCustom, "var(--accent)"] : ["Modrinth", "var(--success)"];
                        const folder = f.path && !f.path.startsWith("mods/") ? (f.path.startsWith("shaderpacks/") ? L.srcShader : L.srcRp) : null;
                        return (
                          <div key={(f.path ?? "") + f.filename} className="flex items-center gap-2">
                            <span className="rounded px-1.5 text-[10px] font-semibold" style={{ color: kind[1], background: `color-mix(in srgb, ${kind[1]} 16%, transparent)` }}>{kind[0]}</span>
                            {folder ? <span className="rounded bg-[var(--surface-2,transparent)] px-1.5 text-[10px] text-muted">{folder}</span> : null}
                            <span className="flex-1 truncate text-foreground">{f.title ?? f.filename}</span>
                            <span className="truncate text-xs text-muted">{f.filename}</span>
                          </div>
                        );
                      })}
                      {p.missing.length ? <p className="text-xs text-[var(--state-busy)]">{fmt(L.missing, { m: p.missing.map((m) => m.title).join(", ") })}</p> : null}
                      <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-border pt-2">
                        <Gear className="h-4 w-4 text-muted" />
                        <span className="flex-1 text-foreground">{p.configCount ? fmt(L.configs, { n: p.configCount }) : L.noConfigs}</span>
                      </div>
                      <p className="text-xs text-muted">{L.updateHint}</p>
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      ) : null}

      {tab === "worlds" && props.showWorlds ? (
        props.worldsSlot ?? (
          <div className="panel mt-4 flex flex-col items-center gap-2 px-6 py-10 text-center text-sm text-muted">
            <Lock className="h-7 w-7" />
            <h3 className="text-base font-semibold text-foreground">{L.lockWT}</h3>
            <p className="max-w-[52ch]">{L.lockWD}</p>
            <button type="button" className={`${btn} mt-2`} onClick={() => setPlansOpen(true)}>
              {L.plansShow}
            </button>
          </div>
        )
      ) : null}

      {/* Offres, repliées par défaut (demande de Rushi du 03/11) */}
      <section className="panel mt-6 p-4">
        <button type="button" className="flex w-full items-center justify-between gap-3 text-left" aria-expanded={plansOpen} onClick={() => setPlansOpen((v) => !v)}>
          <h2 className="text-base font-semibold text-foreground">{L.plansT}</h2>
          <span className="inline-flex items-center gap-1 text-sm text-muted">
            {plansOpen ? L.plansHide : L.plansShow}
            <CaretDown className={`h-4 w-4 transition-transform ${plansOpen ? "rotate-180" : ""}`} />
          </span>
        </button>
        {plansOpen ? (
          <div className="mt-4 flex flex-col gap-4">
            <div className="grid gap-3 md:grid-cols-3">
              {offerCards.map(({ id, o, title, list, price }) => {
                const mine = offer.id === id || (id === "free" && !["supporter", "creator"].includes(offer.id));
                return (
                  <div key={id} className={`flex flex-col gap-2 rounded-xl border p-4 ${mine ? "border-[var(--accent)]" : "border-border"}`}>
                    <h3 className="font-semibold text-foreground">{title}</h3>
                    <p className="text-lg font-bold text-foreground">{price}</p>
                    <p className="text-xs text-muted">{o ? sizeFmt(o.quotaBytes, locale) : ""}</p>
                    <ul className="flex flex-1 flex-col gap-1 text-[13px]">
                      {list.map((x, i) => (
                        <li key={x} className="flex items-start gap-1.5 text-foreground">
                          {id === "free" && i === 2 ? <Minus className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-muted" /> : <Check className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-[var(--success)]" />}
                          <span className={id === "free" && i === 2 ? "text-muted line-through" : ""}>{x}</span>
                        </li>
                      ))}
                    </ul>
                    {mine ? (
                      <span className="rounded-lg bg-surface-raised px-3 py-1.5 text-center text-[13px] font-semibold text-foreground">{L.current}</span>
                    ) : (
                      <button type="button" disabled aria-disabled="true" className="cursor-not-allowed rounded-lg border border-border px-3 py-1.5 text-[13px] text-muted opacity-70">
                        {L.soon}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-muted">{L.ctaSoon}</p>
            <button type="button" className="inline-flex items-center gap-1 self-start text-sm text-[var(--accent)]" aria-expanded={cmpOpen} onClick={() => setCmpOpen((v) => !v)}>
              {L.cmpT}
              <CaretDown className={`h-4 w-4 transition-transform ${cmpOpen ? "rotate-180" : ""}`} />
            </button>
            {cmpOpen ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px] text-[13px]">
                  <thead>
                    <tr className="text-left text-muted">
                      <th className="py-1.5 font-normal" />
                      <th className="py-1.5 text-center font-semibold">{L.free}</th>
                      <th className="py-1.5 text-center font-semibold">{L.sup}</th>
                      <th className="py-1.5 text-center font-semibold">{L.cre}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {L.cr.map((label, row) => (
                      <tr key={label} className="border-t border-border">
                        <td className="py-1.5 text-foreground">{label}</td>
                        {(["free", "supporter", "creator"] as const).map((id) => (
                          <td key={id} className="py-1.5 text-center text-muted">
                            {cmpCell(id, row)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
            <p className="text-xs text-muted">{L.fair}</p>
          </div>
        ) : null}
      </section>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="panel p-4">
          <h2 className="text-sm font-semibold text-foreground">{L.storedT}</h2>
          <ul className="mt-2 flex flex-col gap-1 text-[13px]">
            {L.st.map((x) => (
              <li key={x} className="flex items-start gap-1.5 text-foreground">
                <Check className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-[var(--success)]" />
                {x}
              </li>
            ))}
            <li className="flex items-start gap-1.5 text-muted">
              <Minus className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
              {L.stNo}
            </li>
          </ul>
        </div>
        <div className="panel p-4">
          <h2 className="text-sm font-semibold text-foreground">{L.howT}</h2>
          <p className="mt-2 text-[13px] text-muted">{L.howD}</p>
        </div>
      </div>

      {linking ? <LinkDialog L={L} pack={linking} servers={servers} limit={offer.packServers} onClose={() => setLinking(null)} onDone={done} /> : null}
      {preview ? <PlayerPreview L={L} pack={preview} onClose={() => setPreview(null)} /> : null}
    </div>
  );
}

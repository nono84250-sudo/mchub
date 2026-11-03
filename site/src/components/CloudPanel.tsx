"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { CaretDown, Check, Cube, Eye, Gear, LinkSimple, Lock, MagnifyingGlass, Minus, Package, PencilSimple, Plus, Trash, UploadSimple, X } from "@phosphor-icons/react";
import { useI18n } from "@/i18n/I18nProvider";
import { useConfirm } from "@/components/ConfirmDialog";
import type { Dictionary } from "@/i18n/getDictionary";
import type { CloudPack, CloudUsage, ModHit } from "@/lib/cloudPacks";
import { deleteCloudPackAction, linkCloudPackAction, removeConfigsAction, saveCloudPackAction, searchCloudModsAction, unlinkCloudPackAction } from "@/lib/actions/cloud";

// Page « Mon cloud » (03/11, preview v2 validée par Rushi). Tout ce qui écrit passe par les actions
// de lib/actions/cloud.ts (compte connecté) ou /api/me/cloud/configs (le .zip des configs).
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
const input = "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-[var(--accent)]";

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

// --- Créer / modifier un modpack ---------------------------------------------------------------
function PackEditor({ L, pack, mcVersions, onClose, onDone }: { L: L; pack: CloudPack | null; mcVersions: string[]; onClose: () => void; onDone: (text: string) => void }) {
  const [name, setName] = useState(pack?.name ?? "");
  const [mc, setMc] = useState(pack?.minecraftVersion ?? mcVersions[0] ?? "1.21.1");
  const [loader, setLoader] = useState<string>(pack?.loader ?? "fabric");
  const [mods, setMods] = useState<{ slug: string; title: string }[]>(pack?.projects ?? []);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<ModHit[] | null>(null);
  const [searchErr, setSearchErr] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    const id = ++seq.current;
    const timer = setTimeout(async () => {
      const r = await searchCloudModsAction(q, mc, loader).catch(() => null);
      if (id !== seq.current) return;
      setSearchErr(r === null);
      setHits(r ?? []);
    }, 300);
    return () => clearTimeout(timer);
  }, [q, mc, loader]);

  async function save() {
    setError(null);
    if (!name.trim()) return setError(L.errName);
    if (!mc) return setError(L.errVer);
    if (!mods.length) return setError(L.errMods);
    setSaving(true);
    try {
      const r = await saveCloudPackAction({ id: pack?.id, name, minecraftVersion: mc, loader, mods: mods.map((m) => m.slug) });
      if (!r.ok) return setError(r.error);
      onDone(fmt(L.createdOk, { p: name.trim() }) + (r.missing.length ? ` ${fmt(L.missing, { m: r.missing.join(", ") })}` : ""));
    } catch {
      setError(L.error);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title={pack ? fmt(L.editT, { p: pack.name }) : L.newT}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={btn} onClick={onClose}>
            {L.cancel}
          </button>
          <button type="button" className={btnFill} onClick={save} disabled={saving}>
            {saving ? L.saving : pack ? L.save : L.create}
          </button>
        </>
      }
    >
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted">{L.mName}</span>
        <input className={input} value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="Valoria" />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted">{L.mVer}</span>
          <select className={input} value={mc} onChange={(e) => setMc(e.target.value)}>
            {(mcVersions.includes(mc) ? mcVersions : [mc, ...mcVersions]).map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted">{L.mLoader}</span>
          <select className={input} value={loader} onChange={(e) => setLoader(e.target.value)}>
            {LOADERS.map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex flex-col gap-2 text-sm">
        <span className="text-muted">
          {L.mMods} · {mods.length}
        </span>
        {mods.length ? (
          <div className="flex flex-wrap gap-1.5">
            {mods.map((m) => (
              <span key={m.slug} className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-raised px-2.5 py-1 text-xs text-foreground">
                {m.title}
                <button type="button" aria-label={`${L.remove} ${m.title}`} className="text-muted hover:text-[var(--danger)]" onClick={() => setMods((s) => s.filter((x) => x.slug !== m.slug))}>
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        ) : null}
        <div className="relative">
          <MagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input className={`${input} pl-9`} value={q} onChange={(e) => setQ(e.target.value)} placeholder={L.mSearch} />
        </div>
        <div className="flex max-h-60 flex-col gap-1 overflow-y-auto rounded-lg border border-border p-1">
          {hits === null ? <p className="px-2 py-3 text-xs text-muted">…</p> : null}
          {searchErr ? <p className="px-2 py-3 text-xs text-[var(--danger)]">{L.searchErr}</p> : null}
          {hits && !hits.length && !searchErr ? <p className="px-2 py-3 text-xs text-muted">{L.noHits}</p> : null}
          {(hits ?? []).map((h) => {
            const added = mods.some((m) => m.slug === h.slug);
            return (
              <div key={h.slug} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-surface-raised">
                {h.icon ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={h.icon} alt="" width={28} height={28} className="h-7 w-7 flex-shrink-0 rounded" loading="lazy" />
                ) : (
                  <Package className="h-7 w-7 flex-shrink-0 text-muted" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-foreground">{h.title}</p>
                  <p className="truncate text-[11px] text-muted">{h.description}</p>
                </div>
                <button
                  type="button"
                  className={added ? `${btn} text-[var(--success)]` : btn}
                  disabled={added || mods.length >= 150}
                  onClick={() => setMods((s) => [...s, { slug: h.slug, title: h.title }])}
                >
                  {added ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                  {added ? L.added : L.add}
                </button>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-muted">{L.rpLater}</p>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-[var(--danger)]">
          {error}
        </p>
      ) : null}
    </Modal>
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
  mcVersions: string[];
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
  const [editing, setEditing] = useState<CloudPack | "new" | null>(null);
  const [linking, setLinking] = useState<CloudPack | null>(null);
  const [preview, setPreview] = useState<CloudPack | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const uploadFor = useRef<string | null>(null);

  const pct = usage.quota ? Math.min(100, (usage.total / usage.quota) * 100) : 100;
  const planLabel = offer.id === "creator" ? L.cre : offer.cloud ? L.sup : L.free;
  const say = (text: string, ok = true) => setMessage({ text, ok });
  const done = (text: string) => {
    setEditing(null);
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

  async function uploadConfigs(file: File) {
    const packId = uploadFor.current;
    if (!packId) return;
    if (!/\.zip$/i.test(file.name)) return say(L.configsHint, false);
    setBusy(`c:${packId}`);
    setMessage(null);
    try {
      const res = await fetch(`/api/me/cloud/configs?pack=${encodeURIComponent(packId)}`, { method: "POST", body: file, headers: { "Content-Type": "application/zip" } });
      const out = (await res.json().catch(() => ({}))) as { error?: string; count?: number };
      if (!res.ok) say(out.error ?? L.error, false);
      else {
        say(fmt(L.configsOk, { n: out.count ?? 0 }));
        router.refresh();
      }
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
      <input
        ref={fileRef}
        type="file"
        accept=".zip,application/zip"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void uploadConfigs(f);
        }}
      />
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
            <button type="button" className={btnFill} onClick={() => setEditing("new")}>
              <Plus className="h-4 w-4" />
              {L.newPack}
            </button>
          </div>
          {!packs.length ? (
            <div className="panel flex flex-col items-center gap-2 px-6 py-10 text-center text-sm text-muted">
              <Package className="h-7 w-7" />
              <h3 className="text-base font-semibold text-foreground">{L.emptyPackT}</h3>
              <p className="max-w-[46ch]">{L.emptyPackD}</p>
              <button type="button" className={`${btnFill} mt-2`} onClick={() => setEditing("new")}>
                <Plus className="h-4 w-4" />
                {L.newPack}
              </button>
            </div>
          ) : (
            packs.map((p) => {
              const isOpen = open.has(p.id);
              const meta = [`${p.minecraftVersion} · ${loaderName(p.loader)}`, fmt(L.mods, { n: p.files.length }), p.configCount ? fmt(L.configs, { n: p.configCount }) : L.noConfigs, sizeFmt(p.sizeBytes, locale)].join(" · ");
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
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{fmt(L.mods, { n: p.files.length })}</p>
                      {p.files.map((f) => (
                        <div key={f.projectId + f.filename} className="flex items-center gap-2">
                          <span className="rounded bg-[color-mix(in_srgb,var(--success)_16%,transparent)] px-1.5 text-[10px] font-semibold text-[var(--success)]">Modrinth</span>
                          <span className="flex-1 truncate text-foreground">{f.title ?? f.filename}</span>
                          <span className="truncate text-xs text-muted">{f.filename}</span>
                        </div>
                      ))}
                      {p.missing.length ? <p className="text-xs text-[var(--state-busy)]">{fmt(L.missing, { m: p.missing.map((m) => m.title).join(", ") })}</p> : null}
                      <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-border pt-2">
                        <Gear className="h-4 w-4 text-muted" />
                        <span className="flex-1 text-foreground">
                          {p.configCount ? fmt(L.configs, { n: p.configCount }) : L.noConfigs} <span className="text-xs text-muted">(config/*.json, *.toml…)</span>
                        </span>
                        <button
                          type="button"
                          className={btn}
                          disabled={busy === `c:${p.id}`}
                          onClick={() => {
                            uploadFor.current = p.id;
                            fileRef.current?.click();
                          }}
                        >
                          <UploadSimple className="h-3.5 w-3.5" />
                          {p.configCount ? L.replaceConfigs : L.upConfigs}
                        </button>
                        {p.configCount ? (
                          <button type="button" className={btnDanger} disabled={busy === `r:${p.id}`} onClick={() => run(`r:${p.id}`, () => removeConfigsAction(p.id), L.configsRemoved)}>
                            {L.removeConfigs}
                          </button>
                        ) : null}
                      </div>
                      <p className="text-xs text-muted">{L.configsHint}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <span className="flex-1 text-xs text-muted">{L.rpLater}</span>
                        <button type="button" className={btn} onClick={() => setEditing(p)}>
                          <PencilSimple className="h-3.5 w-3.5" />
                          {L.edit}
                        </button>
                      </div>
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

      {editing ? <PackEditor L={L} pack={editing === "new" ? null : editing} mcVersions={props.mcVersions} onClose={() => setEditing(null)} onDone={done} /> : null}
      {linking ? <LinkDialog L={L} pack={linking} servers={servers} limit={offer.packServers} onClose={() => setLinking(null)} onDone={done} /> : null}
      {preview ? <PlayerPreview L={L} pack={preview} onClose={() => setPreview(null)} /> : null}
    </div>
  );
}

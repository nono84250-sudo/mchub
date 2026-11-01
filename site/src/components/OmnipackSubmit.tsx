"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Package, UploadSimple } from "@phosphor-icons/react";
import { useI18n } from "@/i18n/I18nProvider";

// Envoi d'un .omnipack (Pack Omniscient, 27/10) : le navigateur calcule l'empreinte SHA-256, puis
// envoie le fichier en morceaux de 4 Mio (/api/me/omnipack/part) ; le site vérifie ensuite tout
// lui-même (morceaux, omnipack.json, mods Modrinth seulement).
export type MySubmission = { id: string; name: string; sizeBytes: number; status: string; note: string | null; createdAt: string; versions: number };

const MAX_BYTES = 300 * 1000 * 1000;
const STATUS: Record<string, { key: string; color: string }> = {
  uploading: { key: "omnipack.stUploading", color: "var(--muted)" },
  pending: { key: "omnipack.stPending", color: "var(--state-busy)" },
  imported: { key: "omnipack.stImported", color: "var(--success, #3fa34d)" },
  refused: { key: "omnipack.stRefused", color: "var(--danger, #d64545)" },
};

async function post(path: string, body: unknown) {
  const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export function OmnipackSubmit({ mine }: { mine: MySubmission[] }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const size = (b: number) => `${(b / 1e6).toLocaleString(locale === "fr" ? "fr-FR" : "en-US", { maximumFractionDigits: 1 })} ${locale === "fr" ? "Mo" : "MB"}`;

  async function send(file: File) {
    setMsg(null);
    if (!/\.omnipack$/i.test(file.name)) return setMsg({ text: t("omnipack.notOmni"), ok: false });
    if (file.size > MAX_BYTES) return setMsg({ text: t("omnipack.tooBig"), ok: false });
    setBusy(true);
    let id: string | null = null;
    try {
      setProgress(t("omnipack.hashing"));
      const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
      const sha256 = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
      const start = await post("/api/me/omnipack", { action: "start", name: file.name, sizeBytes: file.size, sha256 });
      id = start.id as string;
      for (let n = 0; n < start.parts; n++) {
        setProgress(t("omnipack.sending", { pct: Math.round((n / start.parts) * 100) }));
        const chunk = file.slice(n * start.partSize, Math.min(file.size, (n + 1) * start.partSize));
        let tries = 0;
        for (;;) {
          const res = await fetch(`/api/me/omnipack/part?id=${encodeURIComponent(start.id)}&n=${n}`, { method: "POST", headers: { "Content-Type": "application/octet-stream" }, body: chunk });
          if (res.ok) break;
          // Une coupure : on réessaie ce morceau deux fois avant d'abandonner.
          if (++tries >= 3) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
        }
      }
      setProgress(t("omnipack.checking"));
      await post("/api/me/omnipack", { action: "finish", id });
      setMsg({ text: t("omnipack.sent"), ok: true });
      router.refresh();
    } catch (error) {
      if (id) post("/api/me/omnipack", { action: "cancel", id }).catch(() => {});
      setMsg({ text: t("omnipack.error", { msg: error instanceof Error ? error.message : String(error) }), ok: false });
      router.refresh();
    } finally {
      setBusy(false);
      setProgress(null);
      if (input.current) input.current.value = "";
    }
  }

  async function cancel(id: string) {
    try {
      await post("/api/me/omnipack", { action: "cancel", id });
    } catch (error) {
      setMsg({ text: t("omnipack.error", { msg: error instanceof Error ? error.message : String(error) }), ok: false });
    }
    router.refresh();
  }

  return (
    <div className="mt-6 flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-[var(--color-divider)] bg-surface p-5">
        <input ref={input} type="file" accept=".omnipack" className="hidden" onChange={(e) => e.target.files?.[0] && send(e.target.files[0])} />
        <button
          type="button"
          disabled={busy}
          onClick={() => input.current?.click()}
          className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          <UploadSimple className="h-4 w-4" />
          {t("omnipack.pick")}
        </button>
        {progress ? <span className="text-sm text-muted">{progress}</span> : null}
        {msg ? <span className={`text-sm ${msg.ok ? "text-[var(--success,#3fa34d)]" : "text-[var(--danger,#d64545)]"}`}>{msg.text}</span> : null}
      </div>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">{t("omnipack.mine")}</h2>
        {mine.length === 0 ? (
          <p className="text-sm text-muted">{t("omnipack.none")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {mine.map((s) => {
              const st = STATUS[s.status] ?? STATUS.pending;
              return (
                <li key={s.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-[var(--color-divider)] bg-surface px-4 py-3">
                  <Package className="h-5 w-5 flex-shrink-0 text-muted" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-foreground">{s.name}</span>
                    <span className="block text-xs text-muted">
                      {size(s.sizeBytes)}
                      {s.versions ? ` · ${t("omnipack.versions", { n: s.versions })}` : ""}
                      {" · "}
                      {new Date(s.createdAt).toLocaleDateString(locale === "fr" ? "fr-FR" : "en-US", { day: "numeric", month: "long" })}
                    </span>
                    {s.note ? <span className="mt-1 block text-xs text-muted">{t("omnipack.note", { note: s.note })}</span> : null}
                  </span>
                  <span className="rounded-full px-2 py-0.5 text-xs font-semibold" style={{ color: st.color, background: `color-mix(in srgb, ${st.color} 14%, transparent)` }}>
                    {t(st.key)}
                  </span>
                  {s.status === "pending" || s.status === "uploading" ? (
                    <button type="button" onClick={() => cancel(s.id)} className="rounded-md border border-[var(--color-divider)] px-3 py-1 text-xs text-muted hover:text-foreground">
                      {t("omnipack.cancel")}
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

// « + Ajouter un pack » (page admin Packs officiels, 31/10) : l'admin envoie son propre .omnipack,
// qui apparaît dans « Packs proposés » comme s'il l'avait proposé (rattaché à son compte joueur).
// Même méthode que la page joueur : empreinte SHA-256 dans le navigateur, morceaux de 4 Mio.
const MAX_BYTES = 300 * 1000 * 1000;

async function post(body: unknown) {
  const res = await fetch("/api/admin/omnipack", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export function AddPackButton() {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  async function send(file: File) {
    setMsg(null);
    if (!/\.omnipack$/i.test(file.name)) return setMsg({ text: "Choisis un fichier .omnipack.", ok: false });
    if (file.size > MAX_BYTES) return setMsg({ text: "Fichier trop gros (300 Mo au plus).", ok: false });
    setBusy(true);
    let id: string | null = null;
    try {
      setMsg({ text: "Calcul de l'empreinte…", ok: true });
      const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
      const sha256 = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
      const start = await post({ action: "start", name: file.name, sizeBytes: file.size, sha256 });
      id = start.id as string;
      for (let n = 0; n < start.parts; n++) {
        setMsg({ text: `Envoi… ${Math.round((n / start.parts) * 100)} %`, ok: true });
        const chunk = file.slice(n * start.partSize, Math.min(file.size, (n + 1) * start.partSize));
        let tries = 0;
        for (;;) {
          const res = await fetch(`/api/admin/omnipack?part=1&id=${encodeURIComponent(start.id)}&n=${n}`, { method: "POST", headers: { "Content-Type": "application/octet-stream" }, body: chunk });
          if (res.ok) break;
          if (++tries >= 3) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
        }
      }
      setMsg({ text: "Vérification du pack…", ok: true });
      await post({ action: "finish", id });
      setMsg({ text: "Pack ajouté : il est dans « Packs proposés ».", ok: true });
      router.refresh();
    } catch (error) {
      if (id) post({ action: "cancel", id }).catch(() => {});
      setMsg({ text: error instanceof Error ? error.message : String(error), ok: false });
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, maxWidth: 360 }}>
      <input ref={input} type="file" accept=".omnipack" style={{ display: "none" }} onChange={(e) => e.target.files?.[0] && send(e.target.files[0])} />
      <button
        type="button"
        disabled={busy}
        onClick={() => input.current?.click()}
        style={{ border: "1px solid var(--color-accent)", color: "#fff", background: "var(--color-accent)", padding: "9px 16px", borderRadius: "var(--radius-md)", font: "500 13.5px var(--font-heading)", cursor: "pointer", whiteSpace: "nowrap", opacity: busy ? 0.6 : 1 }}
      >
        + Ajouter un pack
      </button>
      {msg ? <span style={{ fontSize: 12.5, textAlign: "right", color: msg.ok ? "var(--muted)" : "var(--danger)" }}>{msg.text}</span> : null}
    </div>
  );
}

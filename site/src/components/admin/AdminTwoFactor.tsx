"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { buttonStyle, inputStyle } from "@/components/admin/AdminLoginForm";

// Écrans de double authentification du panel admin (maquette validée par Rushi le 15/10) :
// configuration (QR code → premier code → codes de secours) et saisie du code à chaque
// connexion. Voir app/admin/double-authentification/page.tsx et api/admin/2fa/*.

const MUTED = "var(--muted, var(--color-neutral-500))";
const cardStyle: React.CSSProperties = {
  padding: 22,
  borderRadius: "var(--radius-md)",
  border: "1px solid var(--color-divider)",
  background: "var(--color-surface)",
  display: "flex",
  flexDirection: "column",
  gap: 14,
};
const codeInputStyle: React.CSSProperties = {
  ...inputStyle,
  fontFamily: "ui-monospace, 'Cascadia Mono', Consolas, monospace",
  fontSize: 26,
  letterSpacing: "0.42em",
  textAlign: "center",
  padding: "12px 8px 12px calc(8px + 0.42em)",
  fontVariantNumeric: "tabular-nums",
  width: "100%",
};
const linkStyle: React.CSSProperties = {
  background: "none",
  border: 0,
  padding: 0,
  color: "var(--color-accent)",
  font: "inherit",
  fontSize: 13,
  cursor: "pointer",
  textDecoration: "underline",
  textUnderlineOffset: 3,
  justifySelf: "start",
  textAlign: "left",
};
const ghostButtonStyle: React.CSSProperties = { ...buttonStyle, background: "transparent", color: "var(--color-accent)" };

function boxStyle(color: string): React.CSSProperties {
  return { padding: "10px 12px", borderRadius: "var(--radius-md)", fontSize: 13, background: `color-mix(in srgb, ${color} 12%, transparent)`, color };
}

function Steps({ current }: { current: 1 | 2 | 3 }) {
  const labels = ["1. Scanner", "2. Vérifier", "3. Codes de secours"];
  return (
    <div style={{ display: "flex", gap: 6, fontSize: 12, color: MUTED }}>
      {labels.map((label, i) => (
        <span
          key={label}
          style={{
            flex: 1,
            paddingTop: 6,
            borderTop: `2px solid ${i + 1 < current ? "var(--success)" : i + 1 === current ? "var(--color-accent)" : "var(--color-divider)"}`,
            color: i + 1 === current ? "var(--color-text)" : undefined,
          }}
        >
          {label}
        </span>
      ))}
    </div>
  );
}

async function postJson(url: string, body: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}

function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  return {
    copied,
    copy(key: string, text: string) {
      navigator.clipboard?.writeText(text).then(
        () => {
          setCopied(key);
          setTimeout(() => setCopied(null), 1200);
        },
        () => {},
      );
    },
  };
}

function SwitchAccount() {
  const router = useRouter();
  return (
    <button
      type="button"
      style={linkStyle}
      onClick={async () => {
        await fetch("/api/admin/logout", { method: "POST" });
        router.push("/admin/login");
        router.refresh();
      }}
    >
      Changer de compte
    </button>
  );
}

function RecoveryCodesList({ codes }: { codes: string[] }) {
  const { copied, copy } = useCopy();
  return (
    <>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: "6px 14px",
          padding: 14,
          borderRadius: "var(--radius-md)",
          background: "var(--color-bg)",
          border: "1px solid var(--color-divider)",
        }}
      >
        {codes.map((c) => (
          <code key={c} style={{ fontFamily: "ui-monospace, 'Cascadia Mono', Consolas, monospace", fontSize: 15, letterSpacing: "0.04em" }}>
            {c}
          </code>
        ))}
      </div>
      <div>
        <button type="button" style={ghostButtonStyle} onClick={() => copy("codes", codes.join("\n"))}>
          {copied === "codes" ? "Copié" : `Copier les ${codes.length} codes`}
        </button>
      </div>
    </>
  );
}

export function AdminTwoFactorSetup({ username, qrSvg, secret }: { username: string; qrSvg: string; secret: string }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [ack, setAck] = useState(false);
  const { copied, copy } = useCopy();

  async function verify(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const { ok, data } = await postJson("/api/admin/2fa/setup", { code });
    setBusy(false);
    if (data.expired) {
      router.push("/admin/login");
      return;
    }
    if (!ok) {
      setError(
        data.error === "QR code expiré : recharge la page." || data.locked
          ? data.error
          : `${data.error ?? "Code incorrect."} Vérifie que l'heure de ton téléphone est automatique, puis tape le code affiché maintenant.`,
      );
      setCode("");
      return;
    }
    setRecoveryCodes(data.recoveryCodes);
  }

  if (recoveryCodes) {
    return (
      <>
        <h1 style={{ margin: 0, fontWeight: 500, fontSize: 24, letterSpacing: "-0.01em" }}>Note tes codes de secours</h1>
        <Steps current={3} />
        <div style={cardStyle}>
          <div style={boxStyle("var(--success)")}>Double authentification activée.</div>
          <p style={{ margin: 0, color: MUTED, fontSize: 13.5 }}>
            Si tu perds ton téléphone, chacun de ces codes remplace une fois le code à 6 chiffres. Écris-les sur papier et range-les : ils ne
            seront plus jamais affichés.
          </p>
          <RecoveryCodesList codes={recoveryCodes} />
          <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 13.5, cursor: "pointer" }}>
            <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} style={{ marginTop: 3, accentColor: "var(--color-accent)" }} />
            <span>J&apos;ai noté mes codes dans un endroit sûr</span>
          </label>
          <button
            type="button"
            disabled={!ack}
            style={{ ...buttonStyle, opacity: ack ? 1 : 0.45, cursor: ack ? "pointer" : "not-allowed" }}
            onClick={() => {
              router.push("/admin/servers");
              router.refresh();
            }}
          >
            Terminer et ouvrir le panneau
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <h1 style={{ margin: 0, fontWeight: 500, fontSize: 24, letterSpacing: "-0.01em" }}>Protège ton compte</h1>
      <Steps current={code.length === 6 ? 2 : 1} />
      <form onSubmit={verify} style={cardStyle}>
        <p style={{ margin: 0, color: MUTED, fontSize: 13.5 }}>
          Le panneau admin demande un code de ton téléphone en plus du mot de passe. Ça prend une minute, une seule fois.
        </p>
        <h2 style={{ margin: 0, fontWeight: 500, fontSize: 16 }}>Scanne ce QR code avec une appli d&apos;authentification :</h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center" }}>
          <div
            style={{ width: 148, height: 148, background: "#ffffff", borderRadius: "var(--radius-md)", padding: 8, flexShrink: 0 }}
            role="img"
            aria-label={`QR code de configuration pour ${username}`}
            dangerouslySetInnerHTML={{ __html: qrSvg }}
          />
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, display: "grid", gap: 2 }}>
            <li>Google Authenticator</li>
            <li>Microsoft Authenticator</li>
            <li>Aegis (Android)</li>
            <li>2FAS, Authy…</li>
          </ul>
        </div>
        <details>
          <summary style={{ cursor: "pointer", color: "var(--color-accent)", fontSize: 13 }}>Je ne peux pas scanner</summary>
          <p style={{ margin: "8px 0 6px", fontSize: 12.5, color: MUTED }}>Dans l&apos;appli, choisis « Saisir une clé » et tape :</p>
          <div
            style={{
              fontFamily: "ui-monospace, 'Cascadia Mono', Consolas, monospace",
              fontSize: 13,
              padding: "8px 10px",
              borderRadius: "var(--radius-md)",
              background: "var(--color-bg)",
              border: "1px dashed var(--color-divider)",
              wordBreak: "break-all",
              display: "flex",
              gap: 8,
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span>{secret}</span>
            <button
              type="button"
              onClick={() => copy("secret", secret.replace(/ /g, ""))}
              style={{ font: "inherit", fontSize: 12, padding: "3px 9px", borderRadius: 6, border: "1px solid var(--color-divider)", background: "var(--color-surface)", color: "var(--color-text)", cursor: "pointer", flexShrink: 0 }}
            >
              {copied === "secret" ? "Copié" : "Copier"}
            </button>
          </div>
        </details>
        <label htmlFor="setup-code" style={{ fontSize: 12.5, color: MUTED }}>
          Code à 6 chiffres affiché par l&apos;appli
        </label>
        <input
          id="setup-code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          placeholder="••••••"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          aria-invalid={error ? true : undefined}
          style={{ ...codeInputStyle, borderColor: error ? "var(--danger)" : undefined }}
          autoFocus
        />
        {error && <p role="alert" style={{ color: "var(--danger)", margin: 0, fontSize: 13 }}>{error}</p>}
        <button
          type="submit"
          disabled={busy || code.length !== 6}
          style={{ ...buttonStyle, opacity: code.length === 6 ? 1 : 0.45, cursor: code.length === 6 ? "pointer" : "not-allowed" }}
        >
          {busy ? "Vérification…" : "Vérifier et activer"}
        </button>
        <SwitchAccount />
      </form>
    </>
  );
}

export function AdminTwoFactorVerify({ username }: { username: string }) {
  const router = useRouter();
  const [useBackup, setUseBackup] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const ready = useBackup ? value.replace(/-/g, "").length === 8 : value.length === 6;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setLocked(false);
    const { ok, data } = await postJson("/api/admin/2fa/verify", useBackup ? { recoveryCode: value } : { code: value });
    setBusy(false);
    if (data.expired) {
      router.push("/admin/login");
      return;
    }
    if (!ok) {
      setError(data.error ?? "Code incorrect.");
      setLocked(!!data.locked);
      setValue("");
      return;
    }
    const next = data.mustChangeCredentials ? "/admin/premiere-connexion" : "/admin/servers";
    if (typeof data.remainingRecoveryCodes === "number") {
      setNotice(
        `Code de secours accepté. Il t'en reste ${data.remainingRecoveryCodes}. Pense à en générer de nouveaux dans Paramètres.`,
      );
      setTimeout(() => {
        router.push(next);
        router.refresh();
      }, 2500);
      return;
    }
    router.push(next);
    router.refresh();
  }

  return (
    <>
      <h1 style={{ margin: 0, fontWeight: 500, fontSize: 24, letterSpacing: "-0.01em" }}>Code de vérification</h1>
      <form onSubmit={submit} style={cardStyle}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "space-between", alignItems: "center", fontSize: 12.5 }}>
          <span style={{ color: MUTED }}>
            Connecté en tant que <b style={{ color: "var(--color-text)", fontWeight: 500 }}>{username}</b>
          </span>
          <SwitchAccount />
        </div>
        <label htmlFor="login-code" style={{ fontSize: 12.5, color: MUTED }}>
          {useBackup ? "Code de secours (ex. 4KQ7-MX2P)" : "Ouvre ton appli d'authentification et tape le code à 6 chiffres pour Omniscient."}
        </label>
        {useBackup ? (
          <input
            id="login-code"
            autoComplete="off"
            maxLength={9}
            placeholder="XXXX-XXXX"
            value={value}
            onChange={(e) => {
              const v = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
              setValue(v.length > 4 ? `${v.slice(0, 4)}-${v.slice(4)}` : v);
            }}
            style={{ ...codeInputStyle, fontSize: 18, letterSpacing: "0.18em", paddingLeft: "calc(8px + 0.18em)" }}
            autoFocus
          />
        ) : (
          <input
            id="login-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="••••••"
            value={value}
            onChange={(e) => setValue(e.target.value.replace(/\D/g, "").slice(0, 6))}
            aria-invalid={error ? true : undefined}
            style={{ ...codeInputStyle, borderColor: error ? "var(--danger)" : undefined }}
            autoFocus
          />
        )}
        {error && (locked ? <div role="alert" style={boxStyle("var(--warn)")}>{error}</div> : <p role="alert" style={{ color: "var(--danger)", margin: 0, fontSize: 13 }}>{error}</p>)}
        {notice && <div role="status" style={boxStyle("var(--success)")}>{notice}</div>}
        <button
          type="submit"
          disabled={busy || !ready || !!notice}
          style={{ ...buttonStyle, opacity: ready ? 1 : 0.45, cursor: ready ? "pointer" : "not-allowed" }}
        >
          {busy ? "Vérification…" : "Confirmer"}
        </button>
        <button
          type="button"
          style={linkStyle}
          onClick={() => {
            setUseBackup(!useBackup);
            setValue("");
            setError(null);
          }}
        >
          {useBackup ? "Utiliser l'appli plutôt" : "Utiliser un code de secours"}
        </button>
        <p style={{ margin: 0, fontSize: 12.5, color: MUTED }}>
          Téléphone perdu et plus de codes ? Demande à un admin de réinitialiser ta double authentification.
        </p>
      </form>
    </>
  );
}

// Paramètres : générer de nouveaux codes de secours (les anciens cessent de marcher).
export function AdminRecoveryCodesCard() {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [codes, setCodes] = useState<string[] | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const { ok, data } = await postJson("/api/admin/2fa/recovery-codes", { code });
    setBusy(false);
    setCode("");
    if (!ok) {
      setError(data.error ?? "Code incorrect.");
      return;
    }
    setCodes(data.recoveryCodes);
  }

  if (codes) {
    return (
      <div style={{ display: "grid", gap: 12, maxWidth: 420 }}>
        <div style={boxStyle("var(--success)")}>Nouveaux codes créés. Les anciens ne marchent plus. Note ceux-ci : ils ne seront plus affichés.</div>
        <RecoveryCodesList codes={codes} />
      </div>
    );
  }

  return (
    <form onSubmit={submit} style={{ display: "grid", gap: 12, maxWidth: 360 }}>
      <p style={{ margin: 0, fontSize: 13, color: MUTED }}>
        La double authentification est activée. Si tu as utilisé ou perdu tes codes de secours, génères-en de nouveaux avec un code de ton appli.
      </p>
      <input
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        placeholder="Code à 6 chiffres"
        aria-label="Code à 6 chiffres de ton appli"
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
        style={inputStyle}
      />
      {error && <p role="alert" style={{ color: "var(--danger)", margin: 0 }}>{error}</p>}
      <button type="submit" disabled={busy || code.length !== 6} style={buttonStyle}>
        {busy ? "Génération…" : "Générer de nouveaux codes de secours"}
      </button>
    </form>
  );
}

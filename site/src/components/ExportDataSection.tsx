"use client";

import { useState } from "react";
import { DownloadSimple, EnvelopeSimple, CheckCircle, FileText } from "@phosphor-icons/react";
import { exportMyData, getMyDataInfo, type DataExportError, type DataExportFiles, type DataExportInfo } from "@/lib/actions/dataExport";
import { useI18n } from "@/i18n/I18nProvider";

// « Recuperer mes donnees » (Parametres du compte, 23/10, preview validee) : le joueur choisit
// Telecharger ou Envoyer par e-mail. Meme forme de fenetre que DeleteAccountSection. Ce qui est
// exporte et la limite d'une demande par 24 h : voir lib/actions/dataExport.ts.

// Ordre d'affichage des categories dans la fenetre (cles de countSelfData).
const ROWS = [
  "serveurs",
  "signalementsEnvoyes",
  "signalementsSurSesServeurs",
  "problemesDInstallation",
  "notifications",
  "avertissements",
  "amis",
  "serveursSuivis",
  "team",
  "demandesDeTeam",
  "demandesDEtiquettes",
] as const;

const ERROR_KEYS: Record<DataExportError, string> = {
  session: "account.exportErrorSession",
  notFound: "account.exportErrorNotFound",
  tooSoon: "account.exportTooSoon",
  email: "account.exportErrorEmail",
  emailMismatch: "account.exportErrorMismatch",
  emailUnavailable: "account.exportErrorEmailUnavailable",
  sendFailed: "account.exportErrorSend",
  busy: "account.exportErrorBusy",
  siteBusy: "account.exportErrorSiteBusy",
};

type Step = "choice" | "email" | "done";

function saveFile(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ExportDataSection() {
  const { t, locale } = useI18n();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("choice");
  const [mode, setMode] = useState<"download" | "email">("download");
  const [info, setInfo] = useState<DataExportInfo | null>(null);
  const [email, setEmail] = useState("");
  const [email2, setEmail2] = useState("");
  const [files, setFiles] = useState<DataExportFiles | null>(null);
  const [sentTo, setSentTo] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const when = (iso: string) =>
    new Date(iso).toLocaleString(locale === "en" ? "en-GB" : "fr-BE", { weekday: "long", hour: "2-digit", minute: "2-digit" });
  const errorText = (code: DataExportError, nextAt?: string) => (code === "tooSoon" && nextAt ? t(ERROR_KEYS[code], { when: when(nextAt) }) : t(ERROR_KEYS[code]));

  async function openDialog() {
    setOpen(true);
    setStep("choice");
    setError(null);
    setFiles(null);
    setInfo(null);
    try {
      const res = await getMyDataInfo();
      if ("error" in res) setError(errorText(res.error));
      else setInfo(res);
    } catch {
      setError(t("account.exportErrorGeneric"));
    }
  }

  function close() {
    if (pending) return;
    setOpen(false);
    setEmail("");
    setEmail2("");
    setError(null);
  }

  async function run() {
    setPending(true);
    setError(null);
    try {
      const res = await exportMyData({ mode, email, emailConfirm: email2, locale: locale === "en" ? "en" : "fr" });
      if ("error" in res) {
        setError(errorText(res.error, res.nextAllowedAt));
      } else if ("files" in res) {
        setFiles(res.files);
        saveFile(res.files.jsonName, res.files.json, "application/json;charset=utf-8");
        saveFile(res.files.txtName, res.files.summary, "text/plain;charset=utf-8");
        setStep("done");
      } else {
        setSentTo(email.trim());
        setEmail("");
        setEmail2("");
        setStep("done");
      }
    } catch {
      setError(t("account.exportErrorGeneric"));
    }
    setPending(false);
  }

  function back() {
    setStep("choice");
    setError(null);
  }
  function primary() {
    if (step === "choice" && mode === "email") {
      setError(null);
      setStep("email");
    } else {
      void run();
    }
  }

  const limited = Boolean(info?.nextAllowedAt);
  const emailOff = info ? !info.emailAvailable : false;
  const empty = info ? ROWS.every((k) => !info.counts[k]) : false;
  const choiceBtn = (value: "download" | "email", Icon: typeof DownloadSimple, title: string, desc: string, disabled = false) => (
    <button
      type="button"
      onClick={() => setMode(value)}
      aria-pressed={mode === value}
      disabled={disabled}
      className="flex flex-col gap-1 rounded-md p-3 text-left disabled:cursor-not-allowed disabled:opacity-50"
      style={{
        border: `1px solid ${mode === value ? "var(--accent)" : "var(--border)"}`,
        background: mode === value ? "color-mix(in srgb, var(--accent) 12%, transparent)" : "var(--surface-raised)",
      }}
    >
      <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Icon className="h-4 w-4" />
        {title}
      </span>
      <span className="text-xs text-muted">{desc}</span>
    </button>
  );

  return (
    <section id="mes-donnees" className="mt-8 border-t border-border pt-6">
      <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.07em] text-accent">{t("account.exportSection")}</h2>
      <p className="text-sm font-medium text-foreground">{t("account.exportTitle")}</p>
      <p className="mt-1 text-xs text-muted">{t("account.exportHint")}</p>
      <button type="button" onClick={openDialog} className="btn-secondary mt-3 text-sm">
        <DownloadSimple className="h-4 w-4" />
        {t("account.exportTitle")}
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={t("account.exportTitle")}
          onKeyDown={(e) => {
            if (e.key === "Escape") close();
          }}
        >
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg bg-surface p-5" style={{ border: "1px solid var(--border)" }}>
            <p className="text-base font-semibold text-foreground">{step === "email" ? t("account.exportEmail") : t("account.exportTitle")}</p>

            {step === "choice" ? (
              <>
                {limited && info?.nextAllowedAt ? (
                  <p className="mt-3 rounded-md p-3 text-xs" style={{ color: "var(--warn)", background: "color-mix(in srgb, var(--warn) 10%, transparent)" }}>
                    {t("account.exportTooSoon", { when: when(info.nextAllowedAt) })}
                  </p>
                ) : null}
                <p className="mt-4 text-sm font-medium text-foreground">{t("account.exportHow")}</p>
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {choiceBtn("download", DownloadSimple, t("account.exportDownload"), t("account.exportDownloadHint"))}
                  {choiceBtn("email", EnvelopeSimple, t("account.exportEmail"), emailOff ? t("account.exportErrorEmailUnavailable") : t("account.exportEmailHint"), emailOff)}
                </div>
                <p className="mt-4 text-sm font-medium text-foreground">{t("account.exportInside")}</p>
                <ul className="mt-2 rounded-md text-sm" style={{ border: "1px solid var(--border)" }}>
                  <li className="flex justify-between gap-3 px-3 py-1.5">
                    <span>{t("account.exportRows.compte")}</span>
                    <span className="tabular-nums text-muted">1</span>
                  </li>
                  {ROWS.map((key) => (
                    <li key={key} className="flex justify-between gap-3 px-3 py-1.5" style={{ borderTop: "1px solid var(--border)" }}>
                      <span>{t(`account.exportRows.${key}`)}</span>
                      <span className="tabular-nums text-muted">{info ? (info.counts[key] ?? 0) : "…"}</span>
                    </li>
                  ))}
                  <li className="flex justify-between gap-3 px-3 py-1.5" style={{ borderTop: "1px solid var(--border)" }}>
                    <span>{t("account.exportRows.presence")}</span>
                    <span className="tabular-nums text-muted">{info ? (info.counts.presence ? "✓" : "—") : "…"}</span>
                  </li>
                </ul>
                {empty ? <p className="mt-3 rounded-md p-3 text-xs text-muted" style={{ background: "var(--surface-raised)" }}>{t("account.exportEmptyNote")}</p> : null}
                <p className="mt-3 rounded-md p-3 text-xs text-muted" style={{ background: "var(--surface-raised)" }}>{t("account.exportNotIncluded")}</p>
              </>
            ) : null}

            {step === "email" ? (
              <>
                <p className="mt-3 rounded-md p-3 text-xs text-muted" style={{ background: "var(--surface-raised)" }}>{t("account.exportNoEmail")}</p>
                <label htmlFor="export-email" className="mt-4 block text-xs font-semibold text-foreground">{t("account.exportEmail1")}</label>
                <input
                  id="export-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoFocus
                  className="mt-1.5 w-full rounded-md border px-3 py-2 text-sm"
                  style={{ borderColor: "var(--border)", background: "var(--background)", color: "var(--foreground)" }}
                />
                <label htmlFor="export-email2" className="mt-3 block text-xs font-semibold text-foreground">{t("account.exportEmail2")}</label>
                <input
                  id="export-email2"
                  type="email"
                  autoComplete="off"
                  value={email2}
                  onChange={(e) => setEmail2(e.target.value)}
                  onPaste={(e) => e.preventDefault()}
                  className="mt-1.5 w-full rounded-md border px-3 py-2 text-sm"
                  style={{ borderColor: "var(--border)", background: "var(--background)", color: "var(--foreground)" }}
                />
              </>
            ) : null}

            {step === "done" ? (
              <>
                <p className="mt-3 flex items-start gap-2 text-sm font-semibold" style={{ color: "var(--success)" }}>
                  <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  {files ? t("account.exportDoneDownload") : t("account.exportDoneEmail", { email: sentTo })}
                </p>
                <p className="mt-1 text-xs text-muted">{files ? t("account.exportDoneDownloadHint") : t("account.exportDoneEmailHint")}</p>
                {files ? (
                  <div className="mt-3 flex flex-col gap-2">
                    {[
                      { name: files.jsonName, label: t("account.exportFileJson"), content: files.json, type: "application/json;charset=utf-8" },
                      { name: files.txtName, label: t("account.exportFileTxt"), content: files.summary, type: "text/plain;charset=utf-8" },
                    ].map((f) => (
                      <button
                        key={f.name}
                        type="button"
                        onClick={() => saveFile(f.name, f.content, f.type)}
                        className="flex items-center gap-3 rounded-md px-3 py-2 text-left"
                        style={{ border: "1px solid var(--border)", background: "var(--surface-raised)" }}
                      >
                        <FileText className="h-4 w-4 shrink-0 text-muted" />
                        <span className="min-w-0 flex-1">
                          <span className="block break-all font-mono text-xs text-foreground">{f.name}</span>
                          <span className="text-xs text-muted">{f.label}</span>
                        </span>
                        <DownloadSimple className="h-4 w-4 shrink-0 text-muted" />
                      </button>
                    ))}
                  </div>
                ) : null}
              </>
            ) : null}

            {error ? (
              <p className="mt-3 text-sm text-danger" role="alert">
                {error}
              </p>
            ) : null}

            <div className="mt-4 flex justify-end gap-2">
              {step === "done" ? (
                <button type="button" onClick={close} className="btn-primary text-sm">
                  {t("account.exportClose")}
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => (step === "email" ? back() : close())}
                    disabled={pending}
                    className="btn-secondary text-sm"
                  >
                    {step === "email" ? t("account.exportBack") : t("account.deleteCancel")}
                  </button>
                  <button
                    type="button"
                    onClick={primary}
                    disabled={pending || !info || limited || (step === "email" && (!email || !email2))}
                    className="btn-primary text-sm"
                  >
                    {pending
                      ? t("account.exportPending")
                      : step === "email"
                        ? t("account.exportSend")
                        : mode === "email"
                          ? t("account.exportContinue")
                          : t("account.exportGo")}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

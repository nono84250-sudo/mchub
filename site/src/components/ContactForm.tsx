"use client";

import { useActionState } from "react";
import { submitContactMessage } from "@/lib/actions/contact";
import { useI18n } from "@/i18n/I18nProvider";

// Formulaire de contact public (/contact) : enregistre juste le message en base, aucun
// email n'est envoye (voir lib/actions/contact.ts). Honeypot "website" cache visuellement et
// retire de l'ordre de tabulation / des lecteurs d'ecran — un visiteur humain ne le voit ni ne
// le remplit jamais, un bot qui remplit tous les champs si.
export function ContactForm() {
  const { t } = useI18n();
  const [state, formAction, pending] = useActionState(submitContactMessage, undefined);
  const error = state && "error" in state ? state.error : null;

  if (state && "success" in state && state.success) {
    return <p className="panel p-4 text-sm text-foreground">{t("contact.success")}</p>;
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="name" className="field-label">
          {t("contact.nameLabel")}
        </label>
        <input id="name" name="name" type="text" required maxLength={200} className="field-input" />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="field-label">
          {t("contact.emailLabel")}
        </label>
        <input id="email" name="email" type="email" required maxLength={200} className="field-input" />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="message" className="field-label">
          {t("contact.messageLabel")}
        </label>
        <textarea id="message" name="message" rows={6} required maxLength={5000} className="field-input" />
      </div>

      {/* Honeypot anti-spam : jamais visible ni atteignable au clavier. */}
      <div aria-hidden="true" style={{ position: "absolute", left: "-9999px", top: "auto", width: 1, height: 1, overflow: "hidden" }}>
        <label htmlFor="website">Website</label>
        <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}

      <button type="submit" disabled={pending} className="btn-primary self-start text-sm">
        {pending ? t("contact.sending") : t("contact.send")}
      </button>
    </form>
  );
}

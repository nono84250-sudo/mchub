"use client";

import { useActionState } from "react";
import { replyToReport } from "@/lib/actions/reports";
import { useI18n } from "@/i18n/I18nProvider";

export function ReportReplyForm({ reportId, existingReply }: { reportId: string; existingReply: string | null }) {
  const { t } = useI18n();
  const [state, formAction, pending] = useActionState(replyToReport.bind(null, reportId), undefined);

  return (
    <form action={formAction} className="flex flex-col gap-1.5">
      <label htmlFor="reply" className="field-label">
        {t("reports.replyLabel")}
      </label>
      <textarea id="reply" name="reply" rows={3} defaultValue={existingReply ?? ""} className="field-input" />
      {state?.error ? <p className="text-sm text-danger">{state.error}</p> : null}
      <button type="submit" disabled={pending} className="btn-secondary self-start text-sm">
        {pending ? t("manage.saving") : t("reports.sendReply")}
      </button>
    </form>
  );
}

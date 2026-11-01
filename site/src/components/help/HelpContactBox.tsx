import Link from "next/link";
import type { Locale } from "@/i18n/locales";
import { HELP_UI } from "@/lib/help/ui";

export function HelpContactBox({ locale }: { locale: Locale }) {
  return (
    <div
      className="flex flex-wrap items-center gap-3 rounded-xl border border-border p-3.5"
      style={{ background: "color-mix(in srgb, var(--accent) 8%, var(--surface))" }}
    >
      <div className="min-w-40 flex-1">
        <p className="text-[14.5px] font-semibold text-foreground">{HELP_UI.stuck[locale]}</p>
        <p className="text-[13px] text-muted">{HELP_UI.stuckSub[locale]}</p>
      </div>
      <Link href="/contact" className="btn-primary px-3 py-1.5 text-[13.5px]">
        {HELP_UI.contact[locale]}
      </Link>
    </div>
  );
}

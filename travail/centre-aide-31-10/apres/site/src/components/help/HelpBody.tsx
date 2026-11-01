import { Info, Warning } from "@phosphor-icons/react/ssr";
import type { HelpBlock } from "@/lib/help/types";
import type { Locale } from "@/i18n/locales";
import { HelpText } from "@/components/help/HelpText";

// Corps d'une page d'aide : paragraphes, intertitres, étapes numérotées, listes, encadrés.
export function HelpBody({ blocks, locale }: { blocks: HelpBlock[]; locale: Locale }) {
  return (
    <div className="flex flex-col gap-4 text-[15px] leading-relaxed text-foreground/90">
      {blocks.map((b, i) => {
        if ("p" in b) {
          return (
            <p key={i}>
              <HelpText text={b.p[locale]} />
            </p>
          );
        }
        if ("h" in b) {
          return (
            <h2 key={i} className="mt-2 text-lg font-semibold tracking-tight text-foreground">
              {b.h[locale]}
            </h2>
          );
        }
        if ("steps" in b) {
          return (
            <ol key={i} className="flex flex-col gap-2.5">
              {b.steps.map((s, j) => (
                <li key={j} className="flex gap-3">
                  <span
                    aria-hidden="true"
                    className="mt-0.5 grid h-6 w-6 flex-shrink-0 place-items-center rounded-full text-[12.5px] font-bold text-accent"
                    style={{ background: "color-mix(in srgb, var(--accent) 16%, transparent)" }}
                  >
                    {j + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <HelpText text={s[locale]} />
                  </span>
                </li>
              ))}
            </ol>
          );
        }
        if ("list" in b) {
          return (
            <ul key={i} className="flex list-disc flex-col gap-2 pl-5 marker:text-accent">
              {b.list.map((s, j) => (
                <li key={j}>
                  <HelpText text={s[locale]} />
                </li>
              ))}
            </ul>
          );
        }
        const warn = "warn" in b;
        const text = warn ? b.warn[locale] : b.note[locale];
        const Icon = warn ? Warning : Info;
        return (
          <div
            key={i}
            className="flex gap-2.5 rounded-xl border p-3.5 text-[14.5px]"
            style={{
              borderColor: `color-mix(in srgb, var(${warn ? "--warn" : "--accent"}) 40%, transparent)`,
              background: `color-mix(in srgb, var(${warn ? "--warn" : "--accent"}) 9%, var(--surface))`,
            }}
          >
            <Icon className={`mt-0.5 h-[18px] w-[18px] flex-shrink-0 ${warn ? "text-warn" : "text-accent"}`} weight="fill" />
            <p className="min-w-0 flex-1">
              <HelpText text={text} />
            </p>
          </div>
        );
      })}
    </div>
  );
}

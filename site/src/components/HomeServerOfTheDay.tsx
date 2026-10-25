import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/ssr";
import { getT } from "@/i18n/getDictionary";
import { t } from "@/i18n/t";
import { fallbackBanner } from "@/lib/fallbackBanner";
import type { ServerOfTheDay } from "@/lib/public-servers";

// « Petit serveur du jour » (19/10, variante A choisie par Rushi) : un grand bloc a part sur
// l'accueil, avec les chiffres qui expliquent le choix. Choix AUTOMATIQUE et GRATUIT (calcul :
// getServerOfTheDay) : il ne touche jamais au classement de l'annuaire. Une future mise en avant
// payante serait un autre bloc, marque « Sponsorise ». Aucun serveur eligible : le bloc disparait.
export async function HomeServerOfTheDay({ pick }: { pick: ServerOfTheDay }) {
  const { dict } = await getT();
  const d = dict.home.dayPick;
  const s = pick.server;
  const online =
    s.playerCount === null
      ? null
      : s.playerCapacity
        ? t(dict, "home.dayPick.onlineOf", { count: s.playerCount, capacity: s.playerCapacity })
        : t(dict, "home.dayPick.onlineOnly", { count: s.playerCount });

  return (
    <section className="mx-auto max-w-5xl px-4 sm:px-6 pb-12">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-xl font-semibold text-foreground">{d.title}</h2>
        <p className="text-[0.8rem] text-muted">{d.subtitle}</p>
      </div>

      <Link
        href={`/servers/${s.slug}`}
        className="panel glow-card group mt-4 grid overflow-hidden sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]"
      >
        <div
          className="relative min-h-36 overflow-hidden sm:min-h-56"
          style={s.bannerUrl ? undefined : { background: fallbackBanner(s.name) }}
        >
          {s.bannerUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={s.bannerUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <span
              aria-hidden="true"
              className="absolute inset-0 grid place-items-center px-4 text-center text-[28px] font-extrabold leading-tight text-white [text-shadow:0_2px_12px_rgba(0,0,0,0.35)]"
            >
              {s.name.toUpperCase()}
            </span>
          )}
        </div>

        <div className="flex min-w-0 flex-col justify-center gap-2.5 p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-px text-[11.5px] font-semibold"
              style={{ color: "var(--success)", borderColor: "color-mix(in srgb, var(--success) 50%, transparent)" }}
            >
              <span aria-hidden="true">●</span>
              {d.auto}
            </span>
            {s.languages.map((lang) => (
              <span key={lang} className="lang-chip">
                {lang}
              </span>
            ))}
          </div>
          <h3 className="truncate font-heading text-[22px] font-bold text-foreground transition-colors group-hover:text-accent">{s.name}</h3>
          <p className="line-clamp-2 text-sm text-muted">{s.description}</p>
          <div className="flex flex-wrap gap-1.5">
            {online ? <span className="tag-chip text-[12px] tabular-nums">{online}</span> : null}
            {pick.fillPercent !== null ? (
              <span className="tag-chip text-[12px] tabular-nums">{t(dict, "home.dayPick.fill", { percent: pick.fillPercent })}</span>
            ) : null}
            {pick.launches7d > 0 ? (
              <span className="tag-chip text-[12px] tabular-nums">
                {pick.launches7d === 1 ? d.launchesOne : t(dict, "home.dayPick.launches", { count: pick.launches7d })}
              </span>
            ) : null}
          </div>
          <span className="btn-fill mt-1 self-start px-3.5 py-1.5 text-[13.5px]">
            {d.view}
            <ArrowRight className="h-4 w-4" />
          </span>
          <p className="text-xs text-muted">{d.legal}</p>
        </div>
      </Link>
    </section>
  );
}

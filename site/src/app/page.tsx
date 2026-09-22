import Link from "next/link";
import { Compass, GameController, Cube, ArrowRight } from "@phosphor-icons/react/ssr";
import { getT } from "@/i18n/getDictionary";

export default async function Home() {
  const { dict } = await getT();

  const FEATURES = [
    {
      icon: Compass,
      title: dict.home.featureDirectoryTitle,
      description: dict.home.featureDirectoryBody,
      span: true,
    },
    {
      icon: GameController,
      title: dict.home.featureMsTitle,
      description: dict.home.featureMsBody,
    },
    {
      icon: Cube,
      title: dict.home.featureModpackTitle,
      description: dict.home.featureModpackBody,
    },
  ];

  return (
    <div className="relative overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[560px]"
        style={{
          backgroundImage:
            "radial-gradient(50% 45% at 30% 0%, color-mix(in srgb, var(--accent) 30%, transparent), transparent 70%), radial-gradient(45% 40% at 80% 10%, color-mix(in srgb, var(--accent) 22%, transparent), transparent 70%)",
        }}
      />

      <div className="mx-auto max-w-4xl px-4 sm:px-6 py-24 sm:py-32 text-center">
        <span className="fade-in-up inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs text-muted">
          <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden="true" />
          {dict.home.badge}
        </span>

        <h1
          className="fade-in-up mt-6 text-4xl sm:text-6xl font-bold tracking-tight text-foreground text-balance"
          style={{ animationDelay: "0.1s" }}
        >
          {dict.home.titlePrefix} <span className="gradient-text">{dict.home.titleAccent}</span>
        </h1>
        <p
          className="fade-in-up mt-5 text-lg text-muted max-w-2xl mx-auto text-balance"
          style={{ animationDelay: "0.2s" }}
        >
          {dict.home.subtitle}
        </p>
        <div className="fade-in-up mt-9 flex items-center justify-center gap-4" style={{ animationDelay: "0.3s" }}>
          <Link href="/servers" className="btn-primary">
            {dict.home.ctaDiscover}
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href="/signup" className="btn-secondary">
            {dict.home.ctaPublish}
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 sm:px-6 pb-24">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {FEATURES.map((feature, i) => (
            <div
              key={feature.title}
              className={`panel glow-card fade-in-up flex items-center gap-4 p-6 ${feature.span ? "sm:col-span-2" : ""}`}
              style={{ animationDelay: `${0.4 + i * 0.1}s` }}
            >
              <div className="server-icon h-10 w-10 shrink-0">
                <feature.icon className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-heading font-semibold text-foreground">{feature.title}</h3>
                <p className="mt-2 text-sm text-muted">{feature.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

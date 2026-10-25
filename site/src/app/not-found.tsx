import type { Metadata } from "next";
import Link from "next/link";
import { Eye, House } from "@phosphor-icons/react/ssr";
import { getT } from "@/i18n/getDictionary";

export const metadata: Metadata = { title: "Page introuvable — Omniscient" };

// Page 404 (maquette "06 · 404"). La barre du haut et le pied de page viennent du site.
// Lot 8 (18/10) : dans la langue choisie seulement (plus moitie francais, moitie anglais), au tutoiement.
export default async function NotFound() {
  const { dict } = await getT();
  const n = dict.notFound;
  return (
    <section className="relative flex flex-col items-center overflow-hidden px-6 pb-28 pt-24 text-center">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: "radial-gradient(45% 40% at 50% 0%, color-mix(in srgb, var(--accent) 30%, transparent), transparent 70%)",
          opacity: 0.55,
        }}
      />

      <div className="relative flex h-[104px] w-[104px] items-center justify-center rounded-full border border-border bg-surface shadow-md">
        <span
          className="flex h-[62px] w-[62px] items-center justify-center rounded-full"
          style={{
            background: "color-mix(in srgb, var(--accent) 14%, var(--surface))",
            boxShadow: "0 0 22px 2px color-mix(in srgb, var(--accent) 35%, transparent)",
          }}
        >
          <Eye weight="fill" size={30} style={{ color: "var(--accent)", transform: "translateX(5px)" }} />
        </span>
      </div>

      <p className="relative mt-7 font-mono text-[13px] tracking-[0.1em]" style={{ color: "var(--accent)" }}>
        {n.code}
      </p>

      <h1 className="relative mt-3.5 max-w-[640px] text-[42px] font-medium leading-[1.15] tracking-[-0.015em] text-foreground">
        {n.title}
      </h1>

      <p className="relative mt-[22px] max-w-[460px] text-[14.5px] leading-[1.6] text-muted">{n.body}</p>

      <div className="relative mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link href="/" className="btn-fill px-[22px] py-[11px] text-[14px] no-underline">
          <House size={16} />
          {n.home}
        </Link>
        <Link href="/servers" className="btn-secondary px-[22px] py-[11px] text-[14px] no-underline">
          {n.discover}
        </Link>
      </div>
    </section>
  );
}

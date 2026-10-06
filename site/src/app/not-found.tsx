import type { Metadata } from "next";
import Link from "next/link";
import { Eye, House } from "@phosphor-icons/react/ssr";

export const metadata: Metadata = { title: "Page introuvable — Omniscient" };

// Page 404 (maquette "06 · 404"). La barre du haut et le pied de page viennent du site.
export default function NotFound() {
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
        ERREUR 404 · NOT FOUND
      </p>

      <h1 className="relative mt-3.5 max-w-[640px] text-[42px] font-medium leading-[1.15] tracking-[-0.015em] text-foreground">
        Même l&apos;œil omniscient n&apos;a pas vu venir cette page.
      </h1>
      <p className="relative mt-2.5 max-w-[560px] text-[20px] leading-[1.4] text-muted">
        Even the all-seeing eye didn&apos;t see this page coming.
      </p>

      <p className="relative mt-[22px] max-w-[460px] text-[14.5px] leading-[1.6] text-muted">
        La page que vous cherchez a disparu de son champ de vision — comme un serveur qui n&apos;a jamais existé.
        <br />
        <span className="text-[13.5px] opacity-80">
          The page you&apos;re looking for has slipped out of its field of view — like a server that never existed.
        </span>
      </p>

      <div className="relative mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/"
          className="inline-flex items-center gap-2 whitespace-nowrap rounded-md border px-[22px] py-[11px] text-[14px] font-medium no-underline"
          style={{ borderColor: "var(--accent)", color: "var(--accent)" }}
        >
          <House size={16} />
          Retour à l&apos;accueil
        </Link>
        <Link
          href="/servers"
          className="inline-flex items-center gap-2 whitespace-nowrap rounded-md border border-border px-[22px] py-[11px] text-[14px] font-medium text-foreground no-underline"
        >
          Discover servers
        </Link>
      </div>
    </section>
  );
}

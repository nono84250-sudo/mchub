"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Lien du pied de page (19/10) : en bleu SEULEMENT sur la page ou l'on se trouve (avant, la FAQ
// etait bleue partout, comme si c'etait toujours la page active). Meme regle pour tous les liens.
export function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const path = href.split("#")[0] || "/";
  const active = !href.includes("#") && pathname === path;
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={active ? "font-medium text-accent" : "text-muted transition-colors hover:text-foreground"}
    >
      {children}
    </Link>
  );
}

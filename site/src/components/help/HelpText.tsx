import Link from "next/link";
import type { ReactNode } from "react";

// Texte des pages d'aide : **gras** et [lien](/adresse). Rien d'autre n'est interprété (pas de
// HTML) : les textes viennent de articles.ts, mais on reste prudent.
const TOKEN = /(\*\*[^*]+\*\*|\[[^\]]+\]\([^)\s]+\))/g;

export function HelpText({ text }: { text: string }) {
  const parts = text.split(TOKEN).filter(Boolean);
  return (
    <>
      {parts.map((part, i): ReactNode => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return (
            <strong key={i} className="font-semibold text-foreground">
              {part.slice(2, -2)}
            </strong>
          );
        }
        const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(part);
        if (link) {
          const [, label, href] = link;
          return href.startsWith("/") ? (
            <Link key={i} href={href} className="text-accent hover:underline">
              {label}
            </Link>
          ) : (
            <a key={i} href={href} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
              {label}
            </a>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

// Version texte seul (recherche, descriptions pour Google).
export function plainHelpText(text: string): string {
  return text.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/\[([^\]]+)\]\([^)\s]+\)/g, "$1");
}

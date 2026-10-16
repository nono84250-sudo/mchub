"use client";

import { useEffect, useState } from "react";
import type { GalleryItem } from "@/lib/serverPage";

// Galerie d'une fiche (3 captures max., voir PAGE_LIMITS) : la premiere en grand, les autres a
// cote ; un clic agrandit l'image, Echap ou un clic la referme.
export function GalleryGrid({ items }: { items: GalleryItem[] }) {
  const [open, setOpen] = useState<number | null>(null);

  useEffect(() => {
    if (open === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const layout = items.length === 1 ? "grid-cols-1" : items.length === 2 ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-[2fr_1fr]";

  return (
    <>
      <div className={`grid gap-2.5 ${layout}`}>
        {items.map((item, i) => (
          <button
            key={item.url}
            type="button"
            onClick={() => setOpen(i)}
            aria-label={item.caption || `Image ${i + 1}`}
            className={`relative overflow-hidden rounded-lg border border-border ${
              items.length === 3 && i === 0 ? "col-span-2 aspect-video sm:col-span-1 sm:row-span-2 sm:aspect-auto" : "aspect-[16/10]"
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- image deposee par le proprietaire (R2) */}
            <img src={item.url} alt="" className="absolute inset-0 h-full w-full object-cover" />
            {item.caption ? (
              <span className="absolute bottom-1.5 left-2 text-[11px] text-white [text-shadow:0_1px_2px_rgba(0,0,0,.8)]">{item.caption}</span>
            ) : null}
          </button>
        ))}
      </div>
      {open !== null && items[open] ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={items[open].caption || `Image ${open + 1}`}
          onClick={() => setOpen(null)}
          className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-6"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={items[open].url} alt={items[open].caption} className="max-h-full max-w-full rounded-lg object-contain" />
        </div>
      ) : null}
    </>
  );
}

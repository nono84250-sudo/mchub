"use client";

import { useEffect, useRef, useState } from "react";

export type VideoLabels = { play: string; cookies: string; open: string };

// Video de la fiche (validee par Rushi le 16/10) : une vignette sans aucune requete vers YouTube,
// puis le lecteur youtube-nocookie seulement au clic. Si le proprietaire a coche « Lancer
// automatiquement », la video demarre d'elle-meme, sans le son (les navigateurs refusent
// l'autoplay avec le son), quand elle est presque entierement visible (90 %).
export function VideoEmbed({ videoId, autoplay, labels }: { videoId: string; autoplay: boolean; labels: VideoLabels }) {
  const [mode, setMode] = useState<"thumb" | "click" | "auto">("thumb");
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!autoplay || mode !== "thumb" || !boxRef.current) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setMode("auto");
      },
      { threshold: 0.9 },
    );
    io.observe(boxRef.current);
    return () => io.disconnect();
  }, [autoplay, mode, videoId]);

  const src = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0&playsinline=1${mode === "auto" ? "&mute=1" : ""}`;

  return (
    <div className="flex flex-col gap-2">
      <div ref={boxRef} className="relative aspect-video w-full max-w-full overflow-hidden rounded-lg border border-border bg-surface-raised">
        {mode === "thumb" ? (
          <button
            type="button"
            onClick={() => setMode("click")}
            aria-label={labels.play}
            className="absolute inset-0 grid place-items-center focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
          >
            <span className="absolute inset-0 bg-[linear-gradient(135deg,color-mix(in_srgb,var(--accent)_45%,#1d3550),#1d3550)]" />
            <span className="relative grid h-11 w-16 place-items-center rounded-xl bg-[#d22]">
              <span className="ml-1 border-y-[10px] border-l-[16px] border-y-transparent border-l-white" />
            </span>
          </button>
        ) : (
          <iframe
            src={src}
            title={labels.play}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            className="absolute inset-0 h-full w-full border-0"
          />
        )}
      </div>
      <p className="text-xs text-muted">
        {labels.cookies}{" "}
        <a
          href={`https://www.youtube.com/watch?v=${videoId}`}
          target="_blank"
          rel="nofollow ugc noopener noreferrer"
          className="text-accent underline-offset-2 hover:underline"
        >
          {labels.open}
        </a>
      </p>
    </div>
  );
}

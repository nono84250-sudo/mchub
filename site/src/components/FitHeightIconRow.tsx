"use client";

import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

// En-tete « icone + texte » (19/10, variante A choisie par Rushi) : le carre de l'icone prend la
// hauteur du bloc de texte a cote (2, 3 ou 4 lignes), entre un minimum et un maximum, plus petits
// sur telephone. Sert a la fiche serveur, a l'apercu de Ma fiche et a la page de team. Les cartes
// de liste gardent leur petite icone fixe.
export function FitHeightIconRow({
  icon,
  children,
  className = "",
  iconClassName = "server-icon",
  iconStyle,
  min = 64,
  max = 136,
  minPhone = 56,
  maxPhone = 96,
}: {
  icon: ReactNode;
  children: ReactNode;
  className?: string;
  iconClassName?: string;
  iconStyle?: CSSProperties;
  min?: number;
  max?: number;
  minPhone?: number;
  maxPhone?: number;
}) {
  const textRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(min);

  useLayoutEffect(() => {
    const el = textRef.current;
    if (!el) return;
    const phone = window.matchMedia("(max-width: 639px)");
    const update = () => {
      const lo = phone.matches ? minPhone : min;
      const hi = phone.matches ? maxPhone : max;
      setSize(Math.max(lo, Math.min(hi, Math.round(el.offsetHeight))));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    phone.addEventListener("change", update);
    return () => {
      observer.disconnect();
      phone.removeEventListener("change", update);
    };
  }, [min, max, minPhone, maxPhone]);

  return (
    <div className={`flex items-center gap-4 max-sm:gap-3 ${className}`}>
      <span
        aria-hidden="true"
        className={`shrink-0 overflow-hidden rounded-[14px] ${iconClassName}`}
        style={{ ...iconStyle, width: size, height: size, fontSize: Math.round(size * 0.38) }}
      >
        {icon}
      </span>
      <div ref={textRef} className="min-w-0">
        {children}
      </div>
    </div>
  );
}

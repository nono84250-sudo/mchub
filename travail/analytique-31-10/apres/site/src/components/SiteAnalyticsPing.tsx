"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { ANALYTICS_PING_SECONDS, ANALYTICS_SITE_WINDOW_SECONDS } from "@/lib/refreshSettings";

// Panel Analytique (31/10, preview validée par Rushi) : signal « je suis là » du site, une fois par
// minute et seulement si l'onglet est visible. Rien sur l'admin. Le corps ne contient que
// l'identifiant au hasard (pas de page, pas d'info sur le navigateur). L'identifiant change à chaque
// visite : il est remplacé dès que le dernier signal a plus de 2 min. Plusieurs onglets du même
// navigateur partagent l'identifiant et ne comptent qu'une fois, et un seul envoie le signal.
const ID_KEY = "omni-visitor";
const LAST_KEY = "omni-visitor-last";
const PING_MS = ANALYTICS_PING_SECONDS * 1000;
const WINDOW_MS = ANALYTICS_SITE_WINDOW_SECONDS * 1000;
const MIN_GAP_MS = PING_MS - 10_000;
const BACKOFF_MS = 5 * 60_000;

async function sendPing(): Promise<"ok" | "off" | "busy" | "skip"> {
  let visitorId: string | null;
  try {
    const last = Number(localStorage.getItem(LAST_KEY)) || 0;
    const age = Date.now() - last;
    if (age < MIN_GAP_MS) return "skip";
    visitorId = age < WINDOW_MS ? localStorage.getItem(ID_KEY) : null;
    if (!visitorId) {
      visitorId = crypto.randomUUID();
      localStorage.setItem(ID_KEY, visitorId);
    }
    localStorage.setItem(LAST_KEY, String(Date.now()));
  } catch {
    return "off"; // Stockage bloqué : pas de signal plutôt qu'un visiteur compté plusieurs fois.
  }
  const res = await fetch("/api/analytics/ping", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ visitorId }),
  }).catch(() => null);
  if (res?.status === 404) return "off";
  return !res || res.status === 429 || res.status === 503 ? "busy" : "ok";
}

export function SiteAnalyticsPing() {
  const pathname = usePathname();
  const onAdmin = pathname?.startsWith("/admin") ?? false;

  useEffect(() => {
    if (onAdmin) return;
    let stopped = false;
    let pausedUntil = 0;
    let running = false;
    const tick = async () => {
      if (stopped || running || document.visibilityState !== "visible" || Date.now() < pausedUntil) return;
      running = true;
      const result = await sendPing();
      running = false;
      if (result === "off") stop();
      else if (result === "busy") pausedUntil = Date.now() + BACKOFF_MS;
    };
    const timer = setInterval(tick, PING_MS);
    const stop = () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
    document.addEventListener("visibilitychange", tick);
    void tick();
    return stop;
  }, [onAdmin]);

  return null;
}

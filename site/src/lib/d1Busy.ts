import { NextResponse } from "next/server";
import { D1BusyError } from "@/lib/db";

// Base Cloudflare saturee (HTTP 429) ou trop lente (voir D1BusyError dans lib/db.ts) : les
// routes du launcher repondent 503 avec Retry-After au lieu d'une erreur 500. Le launcher
// (>= 25/10) met alors ses appels de fond en pause pendant ce delai au lieu d'insister, ce qui
// laisse la base respirer (audit 25/10, correctif « 429 → 503 » du 19/10).
export const D1_BUSY_RETRY_AFTER_S = 60;

export function d1BusyResponse(): Response {
  return NextResponse.json(
    { error: "Omniscient est très demandé en ce moment, réessaie dans une minute.", busy: true },
    { status: 503, headers: { "Retry-After": String(D1_BUSY_RETRY_AFTER_S) } },
  );
}

// Enveloppe un gestionnaire de route : toute autre erreur remonte telle quelle.
export function withD1Busy<A extends unknown[]>(handler: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (error) {
      if (error instanceof D1BusyError) {
        console.error("[d1Busy]", error.message);
        return d1BusyResponse();
      }
      throw error;
    }
  };
}

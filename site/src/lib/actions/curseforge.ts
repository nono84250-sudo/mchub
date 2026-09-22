"use server";

import { CurseforgeNotConfiguredError, searchCurseforgeModpacks, type CurseforgeModpack } from "@/lib/curseforge";

export type CurseforgeSearchResult =
  | { ok: true; results: CurseforgeModpack[] }
  | { ok: false; notConfigured: boolean; error: string };

export async function searchModpacks(query: string): Promise<CurseforgeSearchResult> {
  try {
    const results = await searchCurseforgeModpacks(query);
    return { ok: true, results };
  } catch (error) {
    if (error instanceof CurseforgeNotConfiguredError) {
      return { ok: false, notConfigured: true, error: error.message };
    }
    return { ok: false, notConfigured: false, error: "La recherche CurseForge a échoué." };
  }
}

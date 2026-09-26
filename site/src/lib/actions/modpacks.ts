"use server";

import { CurseforgeNotConfiguredError, searchCurseforgeModpacks } from "@/lib/curseforge";
import { searchModrinthModpacks } from "@/lib/modrinth";
import type { ModpackSearchResult, ModpackSource } from "@/lib/modpack-types";

export type ModpackSearchResponse =
  | { ok: true; results: ModpackSearchResult[] }
  | { ok: false; notConfigured: boolean; error: string };

// Recherche de modpacks dans la source choisie (CurseForge ou Modrinth) — appelee
// par le composant ModpackPicker, dans l'assistant de creation et dans Parametres.
export async function searchModpacks(query: string, source: ModpackSource): Promise<ModpackSearchResponse> {
  try {
    const results = source === "modrinth" ? await searchModrinthModpacks(query) : await searchCurseforgeModpacks(query);
    return { ok: true, results };
  } catch (error) {
    if (error instanceof CurseforgeNotConfiguredError) {
      return { ok: false, notConfigured: true, error: error.message };
    }
    return { ok: false, notConfigured: false, error: "La recherche du modpack a échoué." };
  }
}

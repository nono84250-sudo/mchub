"use server";

import { isSourceEnabled } from "@/lib/platformSettings";
import { CurseforgeNotConfiguredError, searchCurseforgeModpacks } from "@/lib/curseforge";
import { searchModrinthModpacks } from "@/lib/modrinth";
import type { ModpackSearchResult, ModpackSource } from "@/lib/modpack-types";

export type ModpackSearchResponse =
  | { ok: true; results: ModpackSearchResult[] }
  | { ok: false; notConfigured: boolean; error: string };

// Recherche de modpacks dans la source choisie (CurseForge ou Modrinth) — appelee
// par le composant ModpackPicker, dans l'assistant de creation et dans Parametres.
export async function searchModpacks(query: string, source: ModpackSource): Promise<ModpackSearchResponse> {
  // Interrupteur admin : une source coupée ne répond plus (voir platformSettings.ts).
  if (!(await isSourceEnabled(source === "modrinth" ? "modrinth" : "curseforge"))) {
    return { ok: false, notConfigured: false, error: "Cette source de modpacks est temporairement indisponible." };
  }
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

"use server";

import { isSourceEnabled } from "@/lib/platformSettings";
import { CurseforgeNotConfiguredError, searchCurseforgeModpacks } from "@/lib/curseforge";
import { searchModrinthModpacks } from "@/lib/modrinth";
import { searchFtbModpacks } from "@/lib/ftb";
import { parseModpackSource, type ModpackChannel, type ModpackSearchResult, type ModpackSource } from "@/lib/modpack-types";

export type ModpackSearchResponse =
  | { ok: true; results: ModpackSearchResult[] }
  | { ok: false; notConfigured: boolean; error: string };

// Recherche de modpacks dans la source choisie (CurseForge, Modrinth ou FTB) — appelee
// par le composant ModpackPicker, dans l'assistant de creation et dans Parametres.
// `channel` (toggle "canal bêta" de ModpackPicker) : filtre la liste aux modpacks qui ont une
// version beta quand il vaut "beta" (voir searchCurseforgeModpacks/searchModrinthModpacks/searchFtbModpacks).
export async function searchModpacks(query: string, sourceInput: ModpackSource, channel: ModpackChannel = "release"): Promise<ModpackSearchResponse> {
  // Action serveur : la source vient du navigateur, jamais prise telle quelle.
  const source = parseModpackSource(sourceInput);
  // Interrupteur admin : une source coupée ne répond plus (voir platformSettings.ts).
  if (!(await isSourceEnabled(source))) {
    return { ok: false, notConfigured: false, error: "Cette source de modpacks est temporairement indisponible." };
  }
  try {
    const results =
      source === "modrinth"
        ? await searchModrinthModpacks(query, channel)
        : source === "ftb"
          ? await searchFtbModpacks(query, channel)
          : await searchCurseforgeModpacks(query, channel);
    return { ok: true, results };
  } catch (error) {
    if (error instanceof CurseforgeNotConfiguredError) {
      return { ok: false, notConfigured: true, error: error.message };
    }
    return { ok: false, notConfigured: false, error: "La recherche du modpack a échoué." };
  }
}

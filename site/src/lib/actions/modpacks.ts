"use server";

import { headers } from "next/headers";
import { auth } from "@/auth";
import { isSourceEnabled } from "@/lib/platformSettings";
import { checkRateLimit, clientIpFromHeadersList } from "@/lib/rateLimit";
import { CurseforgeNotConfiguredError, searchCurseforgeModpacks } from "@/lib/curseforge";
import { searchModrinthModpacks } from "@/lib/modrinth";
import type { ModpackChannel, ModpackSearchResult, ModpackSource } from "@/lib/modpack-types";

export type ModpackSearchResponse =
  | { ok: true; results: ModpackSearchResult[] }
  | { ok: false; notConfigured: boolean; error: string };

// Recherche de modpacks dans la source choisie (CurseForge ou Modrinth) — appelee
// par le composant ModpackPicker, dans l'assistant de creation et dans Parametres.
// `channel` (toggle "canal bêta" de ModpackPicker) : filtre la liste aux modpacks qui ont une
// version beta quand il vaut "beta" (voir searchCurseforgeModpacks/searchModrinthModpacks).
export async function searchModpacks(query: string, source: ModpackSource, channel: ModpackChannel = "release"): Promise<ModpackSearchResponse> {
  // Audit 25/10 : action appelable par n'importe qui, avec la cle CurseForge du site. Reservee
  // aux comptes connectes (seuls les proprietaires de fiche s'en servent) et limitee, pour que
  // personne ne puisse epuiser le quota CurseForge de tous les launchers.
  const session = await auth();
  if (!session?.user?.id) return { ok: false, notConfigured: false, error: "Connecte-toi pour chercher un modpack." };
  const ip = clientIpFromHeadersList(await headers());
  if (checkRateLimit(`modpack-search:${session.user.id}`, 30).limited || checkRateLimit(`modpack-search-ip:${ip}`, 60).limited) {
    return { ok: false, notConfigured: false, error: "Trop de recherches, réessaie dans un instant." };
  }
  // Interrupteur admin : une source coupée ne répond plus (voir platformSettings.ts).
  if (!(await isSourceEnabled(source === "modrinth" ? "modrinth" : "curseforge"))) {
    return { ok: false, notConfigured: false, error: "Cette source de modpacks est temporairement indisponible." };
  }
  try {
    const results = source === "modrinth" ? await searchModrinthModpacks(query, channel) : await searchCurseforgeModpacks(query, channel);
    return { ok: true, results };
  } catch (error) {
    if (error instanceof CurseforgeNotConfiguredError) {
      return { ok: false, notConfigured: true, error: error.message };
    }
    return { ok: false, notConfigured: false, error: "La recherche du modpack a échoué." };
  }
}

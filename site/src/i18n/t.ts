import type { Dictionary } from "@/i18n/getDictionary";

type Params = Record<string, string | number>;

function resolve(dict: Dictionary, path: string): string {
  const value = path.split(".").reduce<unknown>((node, key) => {
    if (node && typeof node === "object" && key in node) return (node as Record<string, unknown>)[key];
    return undefined;
  }, dict);
  return typeof value === "string" ? value : path;
}

// Traduction basique : chemin en pointillés ("nav.servers") + interpolation
// {param}. Pas de pluriel ICU générique — les quelques cas au pluriel du
// site utilisent une paire de clés ("count"/"countPlural") choisie par
// l'appelant, plus simple qu'une dépendance dédiée pour ce volume de texte.
export function t(dict: Dictionary, path: string, params?: Params): string {
  let text = resolve(dict, path);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      text = text.replace(`{${key}}`, String(value));
    }
  }
  return text;
}

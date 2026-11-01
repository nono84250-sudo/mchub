import type { PageTag } from "@/lib/serverPage";

// Modeles de fiche (design 2026-10-17, point 7) : au moment de creer une fiche, un
// point de depart qui preremplit la description, le type, la RAM et les etiquettes.
// Le proprietaire peut tout changer ensuite (aucune donnee nouvelle en base : ce
// sont les champs existants, juste preremplis).
export const SERVER_TEMPLATES = {
  survival: { type: "modded", ramGB: 6, tags: ["survival", "tech", "coop"] },
  rpg: { type: "modded", ramGB: 6, tags: ["roleplay", "dungeons", "quests"] },
  cobblemon: { type: "modded", ramGB: 6, tags: ["adventure", "coop", "events"] },
} as const satisfies Record<string, { type: "vanilla" | "modded"; ramGB: number; tags: readonly PageTag[] }>;

export type ServerTemplateId = keyof typeof SERVER_TEMPLATES;

export function isServerTemplate(v: unknown): v is ServerTemplateId {
  return typeof v === "string" && Object.prototype.hasOwnProperty.call(SERVER_TEMPLATES, v);
}

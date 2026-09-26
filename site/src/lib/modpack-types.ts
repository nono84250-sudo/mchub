// Types partages entre les recherches de modpacks (CurseForge, Modrinth) et
// l'interface (ModpackPicker) — sans "server-only" : importes aussi cote client.

export type ModpackSource = "curseforge" | "modrinth";

export const MODPACK_SOURCES: readonly ModpackSource[] = ["curseforge", "modrinth"];

// Source proposee par defaut a la creation d'un serveur : Modrinth, car son
// API est ouverte (aucune cle) et tous les mods d'un modpack y sont
// telechargeables automatiquement, contrairement a CurseForge.
export const DEFAULT_MODPACK_SOURCE: ModpackSource = "modrinth";

export type ModpackSearchResult = {
  id: string;
  name: string;
  summary: string;
  iconUrl: string | null;
  // Nom de la derniere version du modpack (numero de version Modrinth, nom de
  // fichier CurseForge).
  latestVersion: string | null;
  // Version de Minecraft et chargeur de mods (Forge, NeoForge, Fabric, Quilt)
  // de cette derniere version, quand la source les donne — null sinon.
  minecraftVersion: string | null;
  loader: string | null;
};

// Fichier de modpack a installer, tel que le launcher le recoit du site
// (GET /api/launcher/servers/[slug]/modpack). `id` sert de cle de cache et
// d'etat cote launcher : numerique chez CurseForge, texte chez Modrinth.
export type ModpackInstallFile = {
  id: string | number;
  displayName: string;
  fileName: string;
  downloadUrl: string | null;
  fileLength: number;
  sha1: string | null;
};

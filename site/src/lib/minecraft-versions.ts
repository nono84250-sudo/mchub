import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

const MANIFEST_URL = "https://launchermeta.mojang.com/mc/game/version_manifest_v2.json";
const DAY_MS = 24 * 60 * 60 * 1000;
// Le cache fetch de Next (next.revalidate) vit en memoire et repart a zero a chaque
// redemarrage du serveur dev — ce fichier survit aux redemarrages, donc un Mojang lent
// n'est reinterroge qu'une fois par jour meme en developpement (constate le 2026-10-10).
const DISK_CACHE_PATH = path.join(process.cwd(), ".cache", "minecraft-versions.json");

type MojangVersionEntry = { id: string; type: string };
type MojangManifest = { versions: MojangVersionEntry[] };

// Utilisée uniquement si l'API Mojang est injoignable (API down, pas de
// réseau...). Peut être obsolète — la liste en direct fait foi.
const FALLBACK_VERSIONS = ["1.21.4", "1.21.1", "1.20.4", "1.20.1", "1.19.4", "1.18.2", "1.16.5", "1.12.2", "1.8.9", "1.7.10"];

async function readDiskCache(): Promise<string[] | null> {
  try {
    const raw = JSON.parse(await readFile(DISK_CACHE_PATH, "utf8")) as { fetchedAt: number; releases: string[] };
    if (Date.now() - raw.fetchedAt > DAY_MS) return null;
    return raw.releases;
  } catch {
    return null;
  }
}

async function writeDiskCache(releases: string[]): Promise<void> {
  try {
    await mkdir(path.dirname(DISK_CACHE_PATH), { recursive: true });
    await writeFile(DISK_CACHE_PATH, JSON.stringify({ fetchedAt: Date.now(), releases }));
  } catch {
    // Cache best-effort : si l'ecriture echoue (permissions, FS read-only...), on revit juste sans lui.
  }
}

// Va chercher, en direct chez Mojang, la liste des versions "release"
// officielles (donc jamais de snapshot / pre-release / beta / alpha).
// Mise en cache 24h (fetch Next + fichier disque ci-dessus) pour ne pas
// re-interroger Mojang à chaque affichage du formulaire.
export async function getMinecraftVersions(): Promise<string[]> {
  const cached = await readDiskCache();
  if (cached) return cached;

  try {
    // Sans timeout, un Mojang lent/injoignable au moment precis ou le cache est froid
    // (ex. juste apres un redemarrage du serveur dev) bloquait la page /manage/[id]/settings
    // indefiniment au lieu de basculer sur FALLBACK_VERSIONS ci-dessous (constate le 2026-10-10).
    const res = await fetch(MANIFEST_URL, { next: { revalidate: 60 * 60 * 24 }, signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`Réponse ${res.status} de l'API Mojang`);

    const manifest: MojangManifest = await res.json();
    const releases = manifest.versions.filter((v) => v.type === "release").map((v) => v.id);

    if (releases.length === 0) throw new Error("Liste de versions vide");
    await writeDiskCache(releases);
    return releases;
  } catch (error) {
    console.error("[minecraft-versions] Récupération Mojang impossible, repli sur la liste de secours.", error);
    return FALLBACK_VERSIONS;
  }
}

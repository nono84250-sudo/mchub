import "server-only";
import { headers } from "next/headers";

// Partage entre l'accueil (gros bouton Telecharger, design 2026-10-17) et la
// page /download, pour que les deux pointent toujours vers le meme fichier.
//
// Releases publiques du launcher (repo séparé, public, sans le code source —
// voir project_launcher_installer). Le nom de l'installeur (nsisWeb.artifactName
// dans launcher/package.json) est volontairement sans espace ET sans numéro de
// version : sans espace parce que GitHub (points) et le latest.yml
// d'electron-builder (tirets) le sanitisaient chacun différemment, cassant
// silencieusement la mise à jour automatique (électron-updater cherchait un
// fichier qui n'existait pas) ; sans version pour que ce lien direct reste
// valable à chaque nouvelle publication.
export const LAUNCHER_ASSET_NAME = "OmniscientLauncherSetup.exe";
export const LAUNCHER_DOWNLOAD_URL = `https://github.com/nono84250-sudo/omniscient-launcher/releases/latest/download/${LAUNCHER_ASSET_NAME}`;
export const LAUNCHER_RELEASES_LIST_URL = "https://github.com/nono84250-sudo/omniscient-launcher/releases";

export type PlatformId = "windows" | "macos" | "linux" | "phone";

// Telephone/tablette d'abord : on ne propose pas un .exe impossible a
// installer. Seul l'user-agent est visible ici (rendu serveur).
export async function detectPlatform(): Promise<PlatformId> {
  const store = await headers();
  const ua = store.get("user-agent") ?? "";
  if (/android|iphone|ipad|ipod|mobile/i.test(ua)) return "phone";
  if (/mac os x|macintosh/i.test(ua)) return "macos";
  if (/linux/i.test(ua)) return "linux";
  return "windows";
}

// Version/taille lues depuis la release GitHub reelle (jamais figees en dur
// ici — sinon ce texte se decale du binaire reellement servi a chaque nouvelle
// publication). Echoue silencieusement (API GitHub indisponible, pas encore
// de release) : les textes s'affichent alors sans numero.
// Le LIEN de telechargement (LAUNCHER_DOWNLOAD_URL) n'est lui jamais mis en
// cache : il se resout en direct cote GitHub a chaque clic. Revalidate court
// (5 min) + tag pour forcer un rafraichissement juste apres une publication
// (invalidate_by_tags cote Vercel).
export async function getLatestRelease(): Promise<{ version: string; sizeMB: number } | null> {
  try {
    const res = await fetch("https://api.github.com/repos/nono84250-sudo/omniscient-launcher/releases/latest", {
      headers: { Accept: "application/vnd.github+json" },
      next: { revalidate: 300, tags: ["launcher-latest-release"] },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const asset = data.assets?.find((a: { name: string }) => a.name === LAUNCHER_ASSET_NAME);
    const version = typeof data.tag_name === "string" ? data.tag_name.replace(/^v/, "") : null;
    if (!asset || !version) return null;
    return { version, sizeMB: Math.round(asset.size / (1024 * 1024)) };
  } catch {
    return null;
  }
}

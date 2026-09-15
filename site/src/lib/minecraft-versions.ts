const MANIFEST_URL = "https://launchermeta.mojang.com/mc/game/version_manifest_v2.json";

type MojangVersionEntry = { id: string; type: string };
type MojangManifest = { versions: MojangVersionEntry[] };

// Utilisée uniquement si l'API Mojang est injoignable (API down, pas de
// réseau...). Peut être obsolète — la liste en direct fait foi.
const FALLBACK_VERSIONS = ["1.21.4", "1.21.1", "1.20.4", "1.20.1", "1.19.4", "1.18.2", "1.16.5", "1.12.2", "1.8.9", "1.7.10"];

// Va chercher, en direct chez Mojang, la liste des versions "release"
// officielles (donc jamais de snapshot / pre-release / beta / alpha).
// Mise en cache 24h côté Next.js pour ne pas re-interroger Mojang à chaque
// affichage du formulaire.
export async function getMinecraftVersions(): Promise<string[]> {
  try {
    const res = await fetch(MANIFEST_URL, { next: { revalidate: 60 * 60 * 24 } });
    if (!res.ok) throw new Error(`Réponse ${res.status} de l'API Mojang`);

    const manifest: MojangManifest = await res.json();
    const releases = manifest.versions.filter((v) => v.type === "release").map((v) => v.id);

    if (releases.length === 0) throw new Error("Liste de versions vide");
    return releases;
  } catch (error) {
    console.error("[minecraft-versions] Récupération Mojang impossible, repli sur la liste de secours.", error);
    return FALLBACK_VERSIONS;
  }
}

export const OTHER_VERSION_VALUE = "autre";

// Separe de minecraft-versions.ts (qui importe fs/promises, cote serveur uniquement) car
// MinecraftVersionField.tsx est un composant client et ne doit jamais embarquer de code Node.
export const OTHER_VERSION_VALUE = "autre";

// Quick Play (connexion multijoueur directe) n'existe que depuis Minecraft 1.20 (fonctionnalite
// Mojang, voir launcher/src/mcLaunch.js opts.quickPlay) — un numero de version non reconnu
// (snapshot, "autre" vide...) ne declenche pas l'avertissement, faute de certitude. Partage entre
// ServerForm.tsx et NewServerWizard.tsx.
export function supportsAutoConnect(version: string): boolean {
  const match = /^(\d+)\.(\d+)/.exec(version.trim());
  if (!match) return true;
  const [, major, minor] = match;
  return Number(major) > 1 || (Number(major) === 1 && Number(minor) >= 20);
}

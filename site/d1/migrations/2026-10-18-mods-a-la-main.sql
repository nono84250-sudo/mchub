-- Migration 2026-10-18 : « mods à ajouter à la main » (lot 5 de l'audit design, version 3
-- validée par Rushi). Le test de publication du launcher envoie la liste des mods que CurseForge
-- interdit de télécharger automatiquement et qui ne sont pas sur Modrinth. Le site garde le
-- nombre (badge bleu « 2 mods à ajouter » sur les cartes et la fiche) et la liste (noms et page
-- CurseForge, affichés au propriétaire). Remis à zéro avec selfTestPassedAt quand le modpack, la
-- version ou l'adresse changent (voir updateServer dans lib/actions/servers.ts).
--
-- A lancer une seule fois. Lancée sur la base DEV (omniscient-launcher-dev) le 18/10.
-- NE PAS lancer sur la base de production sans l'accord explicite de l'utilisateur.
ALTER TABLE "server" ADD COLUMN "manualModsCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "server" ADD COLUMN "manualModsJson" TEXT;

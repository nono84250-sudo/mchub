-- Migration 2026-10-14 : comptes supprimes par leur proprietaire (voir lib/users.ts et la table
-- "deletedAccount" dans ../schema.sql). Sans cette table, la suppression de compte et le signal
-- de presence du launcher echouent.
--
-- Peut etre rejouee sans risque (IF NOT EXISTS). Une base creee depuis schema.sql a jour n'en a
-- pas besoin.
--
-- NE PAS lancer sur la base de production sans l'accord explicite de l'utilisateur.
CREATE TABLE IF NOT EXISTS "deletedAccount" (
  "minecraftUuidHash" TEXT PRIMARY KEY,
  "deletedAt"         TEXT NOT NULL
);

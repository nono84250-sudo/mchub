-- Mon cloud (03/11, preview « Modpack relié au serveur » validée par Rushi) : en reliant un modpack
-- à son serveur, le propriétaire écrit pourquoi l'utiliser (200 caractères au plus). Le launcher
-- l'affiche sous le choix « Vanilla / <modpack> (moddé) ». Migration ADDITIVE : une colonne vide.
-- Retour arrière : ALTER TABLE "cloudPack" DROP COLUMN "linkNote";
ALTER TABLE "cloudPack" ADD COLUMN "linkNote" TEXT;

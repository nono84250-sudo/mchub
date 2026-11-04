# Omniscient Launcher 0.4.5 — Correctif de bugs

## Bugs corrigés
- Code 1 au premier lancement d'un modpack Forge ou NeoForge juste après son installation : le jeu démarrait avant que Forge ait fini de s'installer. Le launcher attend maintenant la fin de l'installation et vérifie, à chaque lancement, que les fichiers fabriqués par Forge/NeoForge sont là (il les refait s'il en manque).
- Si le jeu s'arrête parce que des fichiers du jeu manquent, la fenêtre d'aide propose directement « Corriger les fichiers du jeu ».
- Import d'un pack CurseForge : la liste « À télécharger à la main » ne s'affichait pas (0/7 sans boutons) quand le pack contient des packs de ressources.
- Data packs d'un pack CurseForge : ils étaient rangés comme des packs de ressources. Ils vont maintenant dans le dossier de Paxi, Open Loader ou Global Packs si le pack en a un, sinon dans chacun de tes mondes de l'installation.
- Le jar du jeu est recopié s'il avait été copié à moitié (avant, seulement s'il manquait).

## Petites améliorations
- Bouton « Terminé » à la fin de l'import d'un pack et dans « Reprendre » : ferme la fenêtre sans lancer le jeu.
- Étiquette « Data pack » dans les listes de fichiers à télécharger à la main.

Correctif de bug

- Plus de plantage (code 1) au premier lancement d'un modpack Forge ou NeoForge juste après son installation : le launcher attend que Forge ait fini de s'installer, et vérifie ses fichiers à chaque lancement (il les refait s'il en manque).
- Quand le jeu s'arrête parce que des fichiers du jeu manquent, la fenêtre d'aide au crash propose directement « Corriger les fichiers du jeu ».
- La liste des fichiers à télécharger à la main s'affiche de nouveau à la fin de l'import d'un modpack (elle restait cachée, « 0/7 » sans boutons, quand le pack contient des packs de ressources).
- Les data packs d'un modpack CurseForge sont rangés au bon endroit : dans le dossier de Paxi, Open Loader ou Global Packs si le pack en a un, sinon dans chaque monde de l'installation (avant, ils étaient pris pour des packs de ressources).
- Les fichiers à la main indiquent leur type : mod, pack de ressources, shader ou data pack.
- Le jeu est recopié s'il avait été copié à moitié (installation coupée en route).
- Nouveau bouton « Terminé » à la fin de l'import d'un modpack et dans « Reprendre », pour fermer sans lancer le jeu.

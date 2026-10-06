# Idée : tags pour les serveurs

Statut : idée à garder pour plus tard. Rien n'est codé.

## Le principe

Quand un propriétaire crée son serveur, il choisit quelques tags décrivant son esprit de jeu (par exemple PvP, Survie, Créatif, Français, Roleplay, Mini-jeux, Modpack). Les joueurs filtrent l'annuaire avec ces tags, et les admins s'en servent pour trier.

## Pourquoi

- L'annuaire ne peut pas être parcouru sans filtre quand il contient des milliers de serveurs.
- Un tag donne une information avant le clic, sans ouvrir la fiche.
- Le panel admin peut repérer les serveurs qui ne correspondent à aucun tag.

## Ce qu'il faudra faire

Côté site :
- Une liste fermée de tags (pas de saisie libre, pour éviter les doublons et les abus).
- Un champ de choix multiple dans le formulaire de création et de modification d'un serveur.
- Une colonne ou une table de liaison en base (un serveur a plusieurs tags, un tag sert à plusieurs serveurs). Migration à faire sur la base de dev d'abord.
- Un filtre dans l'annuaire public et dans la liste admin (`/admin/servers`).
- Affichage des tags sur la fiche publique.

Côté launcher :
- Le launcher affiche les tags dans la liste des serveurs. Ça touche au launcher : proposition à valider avant toute modification.

## Questions à trancher plus tard

1. Liste de tags : qui la décide (l'équipe seulement, ou aussi les propriétaires qui peuvent proposer un tag) ?
2. Nombre maximum de tags par serveur (3 ? 5 ?).
3. Les tags sont-ils obligatoires à la création ?
4. Les tags des serveurs existants : on les demande aux propriétaires, ou l'admin les renseigne ?
5. Le tag « Français » : on le déduit de la langue du site, ou c'est un choix du propriétaire ?

## Lien avec le reste

- Panel admin : page Serveurs (filtre par tag), fiche serveur (modifier les tags en admin).
- Pages publiques : annuaire et fiche serveur.
- Voir aussi `SUIVI_PROJET.md` pour la liste générale des chantiers.

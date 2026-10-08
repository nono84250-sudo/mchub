# Checklist de tests : migration D1 (site + launcher)

À cocher sur Cloudflare, une fois la migration faite. Chaque ligne est à vérifier à la main.

## Accès à la base (D1)
- [ ] Connexion et lecture sur D1 (site et launcher)
- [ ] Écriture et suppression dans chaque table (User, Server, ServerEvent, Report, Notification, platformSetting, adminAccount)
- [ ] Données copiées depuis Postgres correctes (nombre de lignes, dates, booléens)
- [ ] Requêtes SQL brutes réécrites (public-servers ×2, platformSettings, admin credentials)

## Site : compte joueur et propriétaire
- [ ] Connexion Microsoft, création du compte, reconnexion
- [ ] Page compte (pseudo Minecraft)
- [ ] Tableau de bord : liste des serveurs, statuts (Publié, Masqué, Privé, Gelé)
- [ ] Création, modification, suppression d'un serveur
- [ ] Pause / republication, code d'invitation (régénérer, copier)
- [ ] Page Paramètres et Activité (graphiques jour/semaine/mois/année)
- [ ] Page Signalements : réponse, résolution, notification au joueur
- [ ] Serveur gelé : bandeau, statut bleu, bouton republier masqué

## Site : annuaire public
- [ ] Liste publique, recherche, pagination
- [ ] Fiche publique d'un serveur, compteur de vues
- [ ] Serveur privé absent de l'annuaire, accessible par code d'invitation
- [ ] Serveur gelé absent (réponse 404, code "frozen")

## Site : panel admin
- [ ] Connexion admin, changement obligatoire des identifiants
- [ ] Vue d'ensemble (chiffres réels)
- [ ] Serveurs : recherche, filtre (Publié, Masqué, Privé, Gelés), pagination, lignes cliquables
- [ ] Fiche serveur : bouton public, geler / dégeler, masquer, supprimer (confirmation par nom)
- [ ] Geler : motif obligatoire (3 caractères min), notification envoyée au propriétaire
- [ ] Dégeler : option de notification
- [ ] Message au propriétaire : gel, info, avertissement, erreur (popover, champs verrouillés si gelé)
- [ ] Signalements (overview et pages)
- [ ] Pages « Non branché » (surlignage rouge) et « Proposition » (jaune) conformes

## Launcher : liste et serveurs
- [ ] Liste des serveurs, statut en ligne / hors ligne / fermé (« Serveur fermé » en rouge, cohérent entre liste et détail)
- [ ] Bouton Actualiser : cooldown de 30 secondes
- [ ] Favoris et récents, serveur gelé affiché correctement
- [ ] Code d'invitation (saisie manuelle)
- [ ] **Mes instances** : chargement sans erreur 500 / timeout, cache 60 s, badge « Gelé »
- [ ] Sans adresse IP : affichage sans fermer le serveur

## Launcher : lancement
- [ ] Avertissement RAM : deux cases exclusives, alerte rouge à 80 %, persistance du choix
- [ ] Lancement : petit carré en bas à gauche, bouton « démarrage en cours », puis « en cours »
- [ ] Refus du lancement si gelé (message du site affiché)
- [ ] Fermeture du jeu : réaffichage du launcher, restauration de la fenêtre
- [ ] Paramètre « garder le launcher ouvert pendant le jeu »

## Launcher : notifications et signalements
- [ ] Cloche : rafraîchissement toutes les 5 minutes
- [ ] Notifications : réponse, résolution, serveur gelé, messages admin (info, avertissement, erreur)
- [ ] Signalement technique envoyé depuis le launcher

## Divers
- [ ] Déploiement sur Cloudflare fonctionnel (pas seulement en local)
- [ ] Routes API : auth launcher (401 sans token), statut (`/api/launcher/status`)
- [ ] Logs `[debug]` retirés de `servers:mine`
- [ ] Aucune régression visuelle sur mobile (375 px) et desktop

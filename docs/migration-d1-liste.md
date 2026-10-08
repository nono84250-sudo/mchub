# Migration Cloudflare D1 : liste des fichiers et requêtes à réécrire

Relevé en lecture seule, 2026-10-06. Aucun code modifié.

## 1. Fichiers qui touchent la base (35)

Recherche : `db.orm.`, `db.raw.`, `db.runtime()` dans `site/src`. Aucun `db.sql.`, aucun `$transaction`. Les 35 fichiers importent `db` depuis `@/prisma/db`.

### Auth et sessions
- `src/auth.ts` : User (recherche par UUID Minecraft, création, mise à jour)
- `src/lib/adminSession.ts` : AdminAccount (lecture)
- `src/lib/launcherAuth.ts` : User (lecture et mise à jour de `sessionsValidAfter`)
- `src/app/api/admin/login/route.ts` : AdminAccount (lecture)
- `src/app/api/admin/credentials/route.ts` : AdminAccount (lectures + SQL brut UPDATE)

### Serveurs (lib)
- `src/lib/actions/servers.ts` : Server (recherche slug, create, copie, update, delete, code d'invitation)
- `src/lib/inviteCode.ts` : Server (lecture)
- `src/lib/public-servers.ts` : Server, User (listes, détail, recherche) + 2 SQL bruts (`WITH bumped`)
- `src/lib/server-status.ts` : Server (mise à jour du ping)
- `src/lib/status-snapshot.ts` : Server (lecture)
- `src/lib/server-activity.ts` : ServerEvent (lecture)
- `src/lib/platformSettings.ts` : PlatformSetting (lecture + SQL brut INSERT … ON CONFLICT)
- `src/lib/reports.ts` : Report (lecture, création)

### Signalements et notifications
- `src/lib/actions/reports.ts` : Report, Server (lecture, mise à jour)
- `src/lib/notifications.ts` : Notification (create, select, update, delete, en boucle)

### Pages propriétaire
- `src/app/dashboard/(shell)/page.tsx`, `src/app/account/page.tsx`
- `src/app/manage/[id]/` : `layout.tsx`, `page.tsx`, `settings/page.tsx`, `activity/page.tsx`, `reports/page.tsx`

### Pages admin
- `src/app/admin/(panel)/overview/page.tsx` : Server, Report
- `src/app/admin/(panel)/servers/page.tsx` : Server, Report
- `src/app/admin/(panel)/servers/[slug]/` : `page.tsx`, `geler/page.tsx`, `supprimer/page.tsx`

### Routes API admin
- `api/admin/servers/[id]/` : `freeze`, `unfreeze`, `visibility`, `delete`, `message`

### Routes API publiques et launcher
- `api/public/servers/[slug]/route.ts`
- `api/launcher/servers/[slug]/route.ts`
- `api/launcher/servers/[slug]/modpack/route.ts` (lecture et mise à jour Server)

## 2. Bilan
- Requêtes ORM (`db.orm`) : quasi tout le code (select, where, first, all, create, update, delete).
- SQL brut (`db.raw.sql` + `db.runtime().execute`) : 4 requêtes dans 3 fichiers (`public-servers.ts` ×2, `platformSettings.ts`, `credentials/route.ts`). À réécrire à la main en SQL compatible D1.
- Transactions : aucune.
- `src/prisma/db.ts` : à remplacer par la connexion D1 dans tous les cas.

## 3. Tâches en attente (hors migration)
- Retirer les logs `[debug]` de `servers:mine` dans `launcher/src/main.js` une fois « Mes instances » réglé.
- Résoudre les erreurs 500 / timeout du pool Prisma (Mes instances, routes launcher).
- Décider : version stable de Prisma, ou base locale pour les tests de dev.
- Côté launcher : consommer `/api/launcher/status` (non commencé) et corriger la logique « Serveur fermé » (2 échecs consécutifs ; liste et détail cohérents).
- Page joueur (non construite). Lien du nom propriétaire dans la fiche admin (à brancher). Bouton « Transfert de propriété » (placeholder rouge).
- Vérifier visuellement l'affichage du message de serveur gelé dans `game:launch`.
- Supprimer la copie test Cloudflare D1 (`omniscient-test-charge`, contient pseudos et UUID) si tu le demandes.
- Valider visuellement plusieurs éléments d'interface déjà livrés.

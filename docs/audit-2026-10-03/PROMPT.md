# Prompt de réapplication — à donner à un agent

Copie-colle ce texte à l'agent :

---

Tu travailles sur le dépôt `D:\Claude Code\MCHub` (projet Omniscient : launcher Electron dans `launcher/`, site Next.js 16 + Prisma 8 dans `site/`).

Lis d'abord **en entier** le fichier `docs/audit-2026-10-03/RAPPORT.md`. C'est la spécification de tous les changements à réappliquer.

Règles impératives :

1. Commence par vérifier que la branche est bien `master` à `44e6d12` (`git log -1 --format=%h`). Si ce n'est pas le cas, arrête-toi et dis-le.
2. Ne touche JAMAIS au design, au CSS, ni à la mise en page. Si un changement semble l'exiger, arrête-toi et demande.
3. Applique les changements dans l'ordre indiqué à la section 7 du rapport. Après chaque étape : `node --check` pour les fichiers launcher modifiés, `npx tsc --noEmit -p .` et `npx eslint` pour les fichiers site modifiés (depuis `site/`).
4. Le fichier `docs/audit-2026-10-03/correctifs.patch` contient le diff de référence par rapport à `0652b17`. Tu peux t'en servir pour retrouver le code exact, mais ne l'applique pas tel quel : il ne s'appliquera pas sur `44e6d12`.
5. Ne commite rien, ne pousse rien, ne modifie aucun serveur ou base de données.
6. Quand une décision de la section 5 du rapport se présente, demande-la-moi avant de trancher.
7. À la fin, donne-moi : la liste des fichiers modifiés, les résultats des vérifications, et les points restés ouverts.

---

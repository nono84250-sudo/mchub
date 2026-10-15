// Appelle /api/cron/process-scheduled, /api/cron/process-appeals,
// /api/cron/recheck-reachability et /api/cron/process-instance-watch toutes les 5 minutes (voir
// wrangler.jsonc). SITE_URL : "vars"
// dans wrangler.jsonc pour le moment (localhost, ne marchera pas tant que le Worker n'a pas
// d'acces reseau au PC — a passer en URL de prod avant un vrai usage). CRON_SECRET : a definir
// en secret ("wrangler secret put CRON_SECRET"), meme valeur que CRON_SECRET dans site/.env (et
// dans les variables d'env Vercel une fois en prod).
export default {
  async scheduled(event, env, ctx) {
    try {
      const res = await fetch(`${env.SITE_URL}/api/cron/process-scheduled`, {
        method: "POST",
        headers: { Authorization: `Bearer ${env.CRON_SECRET}` },
      });
      if (!res.ok) console.error(`process-scheduled a echoue : ${res.status} ${await res.text()}`);
    } catch (err) {
      console.error(`process-scheduled a echoue : ${err}`);
    }

    // Degel automatique des recours (second avis/delai de reflexion, voir lib/appeals.ts) dont
    // le delai de 72h est ecoule sans decision admin — dans son propre try/catch pour qu'un
    // echec ici n'empeche jamais l'appel ci-dessus (et inversement) de tourner.
    try {
      const res = await fetch(`${env.SITE_URL}/api/cron/process-appeals`, {
        method: "POST",
        headers: { Authorization: `Bearer ${env.CRON_SECRET}` },
      });
      if (!res.ok) console.error(`process-appeals a echoue : ${res.status} ${await res.text()}`);
    } catch (err) {
      console.error(`process-appeals a echoue : ${err}`);
    }

    // Re-verification de disponibilite reseau (badge de fraicheur, voir lib/freshness.ts) de
    // tous les serveurs publies/approuves — meme principe de try/catch isole que les deux
    // appels ci-dessus, pour qu'un echec ici n'empeche jamais les autres de tourner (et
    // inversement). Peut prendre plus de temps que les deux autres (ping reseau de chaque
    // serveur, par lots — voir recheck-reachability/route.ts) : a surveiller si le nombre de
    // serveurs grossit beaucoup.
    try {
      const res = await fetch(`${env.SITE_URL}/api/cron/recheck-reachability`, {
        method: "POST",
        headers: { Authorization: `Bearer ${env.CRON_SECRET}` },
      });
      if (!res.ok) console.error(`recheck-reachability a echoue : ${res.status} ${await res.text()}`);
    } catch (err) {
      console.error(`recheck-reachability a echoue : ${err}`);
    }

    // Suivi de statut d'instance (point 9, case "Me prevenir du changement de statut de cette
    // instance", voir lib/instanceWatch.ts) : notifie les joueurs dont une instance suivie
    // (possedee ou rejointe) repasse en ligne apres avoir ete hors ligne — propre try/catch
    // isole comme les 3 appels ci-dessus. La route elle-meme etale ses envois en petits lots
    // espaces (voir process-instance-watch/route.ts), ce 4e appel ne fait que la declencher.
    try {
      const res = await fetch(`${env.SITE_URL}/api/cron/process-instance-watch`, {
        method: "POST",
        headers: { Authorization: `Bearer ${env.CRON_SECRET}` },
      });
      if (!res.ok) console.error(`process-instance-watch a echoue : ${res.status} ${await res.text()}`);
    } catch (err) {
      console.error(`process-instance-watch a echoue : ${err}`);
    }
  },
};

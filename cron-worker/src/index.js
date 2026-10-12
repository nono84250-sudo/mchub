// Appelle /api/cron/process-scheduled toutes les 5 minutes (voir wrangler.jsonc).
// SITE_URL : "vars" dans wrangler.jsonc pour le moment (localhost, ne marchera pas tant que
// le Worker n'a pas d'acces reseau au PC — a passer en URL de prod avant un vrai usage).
// CRON_SECRET : a definir en secret ("wrangler secret put CRON_SECRET"), meme valeur que
// CRON_SECRET dans site/.env (et dans les variables d'env Vercel une fois en prod).
export default {
  async scheduled(event, env, ctx) {
    const res = await fetch(`${env.SITE_URL}/api/cron/process-scheduled`, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.CRON_SECRET}` },
    });
    if (!res.ok) console.error(`process-scheduled a echoue : ${res.status} ${await res.text()}`);
  },
};

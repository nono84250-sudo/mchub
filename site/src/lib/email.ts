import { Resend } from "resend";

// Envoi d'email transactionnel (verification de compte, mot de passe
// oublie). Desactive proprement si RESEND_API_KEY est absente — meme
// principe que Discord Rich Presence cote launcher (voir discordPresence.js)
// : le code tourne, mais n'envoie rien tant que la cle n'est pas configuree.
// A ce moment-la, le contenu part dans les logs serveur a la place, pour
// pouvoir tester le flux (code/lien visibles dans les logs Vercel) sans
// compte Resend.
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM || "Omniscient <onboarding@resend.dev>";

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

export async function sendEmail({ to, subject, html }: { to: string; subject: string; html: string }): Promise<void> {
  if (!resend) {
    console.log(`[email:disabled] À ${to} — ${subject}\n${html}`);
    return;
  }

  const { error } = await resend.emails.send({ from: EMAIL_FROM, to, subject, html });
  if (error) {
    console.error(`[email:failed] À ${to} — ${subject}`, error);
    throw new Error("Impossible d'envoyer l'email — réessaie dans un instant.");
  }
}

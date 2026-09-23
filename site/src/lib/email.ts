import nodemailer from "nodemailer";
import { Resend } from "resend";

// Envoi d'email transactionnel (verification de compte, mot de passe
// oublie). Deux fournisseurs possibles, dans cet ordre de priorite :
// 1. Gmail (SMTP + mot de passe d'application) — gratuit, aucun nom de
//    domaine requis, marche pour n'importe quel destinataire des
//    aujourd'hui. Choisi en attendant que le projet ait son propre domaine.
// 2. Resend — gratuit aussi, mais necessite un domaine verifie pour envoyer
//    a autre chose qu'a l'adresse du compte Resend lui-meme. Garde en repli
//    pour le jour ou le projet aura un domaine.
// Si aucun des deux n'est configure, le contenu part dans les logs serveur
// a la place (meme principe que Discord Rich Presence cote launcher, voir
// discordPresence.js) — rien de bloquant en dev.
const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM || GMAIL_USER || "Omniscient <onboarding@resend.dev>";

const gmailTransport =
  GMAIL_USER && GMAIL_APP_PASSWORD
    ? nodemailer.createTransport({ service: "gmail", auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD } })
    : null;
const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

export async function sendEmail({ to, subject, html }: { to: string; subject: string; html: string }): Promise<void> {
  if (gmailTransport) {
    try {
      await gmailTransport.sendMail({ from: EMAIL_FROM, to, subject, html });
    } catch (error) {
      console.error(`[email:failed] À ${to} — ${subject}`, error);
      throw new Error("Impossible d'envoyer l'email — réessaie dans un instant.");
    }
    return;
  }

  if (resend) {
    const { error } = await resend.emails.send({ from: EMAIL_FROM, to, subject, html });
    if (error) {
      console.error(`[email:failed] À ${to} — ${subject}`, error);
      throw new Error("Impossible d'envoyer l'email — réessaie dans un instant.");
    }
    return;
  }

  console.log(`[email:disabled] À ${to} — ${subject}\n${html}`);
}

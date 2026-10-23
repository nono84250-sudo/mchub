import nodemailer from "nodemailer";

// Envoi d'e-mails du site (23/10, premier usage : « Recuperer mes donnees » par e-mail, voir
// lib/actions/dataExport.ts). Gmail du projet en SMTP, gratuit (environ 500 e-mails par jour) :
// GMAIL_APP_PASSWORD est un « mot de passe d'application » Google (compte Google > Securite >
// Validation en deux etapes > Mots de passe des applications), jamais le vrai mot de passe.
// Sans cette variable, mailerReady() est faux et l'option e-mail se desactive toute seule.
export const MAIL_FROM_ADDRESS = "omniscient.launchermc@gmail.com";

export function mailerReady(): boolean {
  return Boolean(process.env.GMAIL_APP_PASSWORD?.trim());
}

let transport: nodemailer.Transporter | null = null;
function getTransport() {
  transport ??= nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user: process.env.GMAIL_USER?.trim() || MAIL_FROM_ADDRESS, pass: process.env.GMAIL_APP_PASSWORD?.trim() },
  });
  return transport;
}

export async function sendMail(input: {
  to: string;
  subject: string;
  text: string;
  attachments?: { filename: string; content: string; contentType: string }[];
}): Promise<void> {
  await getTransport().sendMail({
    from: { name: "Omniscient", address: MAIL_FROM_ADDRESS },
    to: input.to,
    subject: input.subject,
    text: input.text,
    attachments: input.attachments,
  });
}

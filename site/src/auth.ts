import NextAuth from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import { db } from "@/prisma/db";
import { getMinecraftProfileFromMicrosoftToken, PendingApprovalError } from "@/lib/xboxAuth";

// "Se connecter avec Microsoft" est desormais l'unique moyen de se
// connecter au site (plus d'email/mot de passe) : le meme identifiant
// d'application que le launcher (voir launcher/src/msAuth.js), deja
// approuve par Microsoft pour l'API Minecraft — reutilise ici via une
// plateforme "Web" additionnelle sur la meme inscription Azure, pas une
// nouvelle appli, pour ne jamais avoir a redemander cette approbation.
// Scope minimal ("openid" + "XboxLive.signin offline_access", jamais
// "profile email") : on ne veut PAS le profil Microsoft — le pseudo/UUID
// viennent uniquement du profil Minecraft/Xbox recupere dans jwt() via
// xboxAuth.ts, seule identite qui compte ici.
export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    MicrosoftEntraID({
      clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID,
      clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
      // GUID fixe du tenant "consumers" (comptes Microsoft personnels) —
      // pas l'alias "consumers" lui-meme : le document de decouverte OIDC
      // renvoie ce GUID dans son champ "issuer", et la validation stricte
      // d'openid-client rejette sinon la reponse ("issuer property does not
      // match the expected value") des que l'alias texte est utilise ici.
      issuer: "https://login.microsoftonline.com/9188040d-6c67-4c5b-b112-36a304b66dad/v2.0",
      // prompt: "select_account" — sans lui, Microsoft reprend en silence le compte
      // deja connecte dans le navigateur, qui n'est pas forcement celui qui possede
      // Minecraft (profil Minecraft introuvable, alors que ca marche avec le bon compte).
      authorization: { params: { scope: "openid XboxLive.signin offline_access", prompt: "select_account" } },
      // Place-holder immediatement remplace dans jwt() par l'identite
      // Minecraft reelle — sans "profile" scope, id_token.name/email sont
      // absents, donc jamais utilises ici.
      profile: (profile) => ({ id: profile.sub, name: profile.sub }),
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      // account n'est present qu'a la connexion initiale (pas a chaque
      // requete) — c'est le seul moment ou on a un access_token Microsoft
      // frais a echanger contre le profil Minecraft/Xbox.
      if (!account?.access_token) return token;

      try {
        const mcProfile = await getMinecraftProfileFromMicrosoftToken(account.access_token);
        let user = await db.orm.public.User.where({ minecraftUuid: mcProfile.uuid }).first();

        if (!user) {
          user = await db.orm.public.User.create({
            name: mcProfile.name,
            minecraftUuid: mcProfile.uuid,
            minecraftUsername: mcProfile.name,
          });
        } else if (user.minecraftUsername !== mcProfile.name || user.name !== mcProfile.name) {
          // Le pseudo Minecraft peut changer avec le temps — resynchronise
          // a chaque connexion plutot que de figer une valeur perimee. La
          // mise a jour porte sur un id deja verifie existant : ne peut pas
          // renvoyer null en pratique (contrairement a un update "en aveugle").
          const updated = await db.orm.public.User.where({ id: user.id }).update({
            name: mcProfile.name,
            minecraftUsername: mcProfile.name,
          });
          if (updated) user = updated;
        }

        token.id = user.id;
        token.name = user.name;
        token.minecraftUsername = user.minecraftUsername;
      } catch (error) {
        // Ne bloque jamais silencieusement : token.id reste absent, donc
        // session.user.id aussi — le reste de l'appli traite deja ca comme
        // "non connecte" (voir les redirect("/login") existants).
        token.error = error instanceof PendingApprovalError ? "pending_approval" : "xbox_auth_failed";
        console.error("[auth] Échec de la récupération du profil Minecraft/Xbox", error);
      }

      return token;
    },
    session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
        session.user.name = token.name as string;
        session.user.minecraftUsername = token.minecraftUsername as string | null;
      }
      if (token.error) session.error = token.error as string;
      return session;
    },
  },
});

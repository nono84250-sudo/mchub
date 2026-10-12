import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    // ATTENTION (audit §2.16) : `id` est garanti par ce type mais peut rester `undefined` a
    // l'execution si l'echange Xbox a echoue a la connexion (voir auth.ts, callback session()) —
    // dans ce cas `error` ci-dessous est toujours renseigne. Un appelant qui lit `session.user.id`
    // doit d'abord verifier l'absence de `session.error`, sinon un `ownerId` undefined passe
    // silencieusement dans une requete DB et renvoie un resultat vide plutot qu'une erreur claire.
    user: {
      id: string;
      minecraftUsername?: string | null;
    } & DefaultSession["user"];
    error?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    minecraftUsername?: string | null;
    error?: string;
  }
}

import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
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

import { S3Client } from "@aws-sdk/client-s3";

// R2 par l'API compatible S3 (le site reste sur Vercel, pas de binding Workers).
// Jeton R2 a creer dans Cloudflare > R2 > "Manage API tokens" (acces Lecture/Ecriture
// sur le bucket omniscient-images uniquement) ; renseigner les trois variables ci-dessous.
export const IMAGES_BUCKET = "omniscient-images";

export const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.CF_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

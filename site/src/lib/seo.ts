// Chemins de l'image de marque generee par code (voir app/opengraph-image.tsx
// et app/twitter-image.tsx). A referencer explicitement dans le `openGraph`/
// `twitter` d'une page qui definit ces champs elle-meme : des qu'un segment
// enfant redefinit `openGraph`, Next remplace entierement celui du parent
// (pas de fusion champ par champ, voir generateMetadata.md "Merging"), donc
// l'image heritee du layout racine se perdrait sinon silencieusement.
export const DEFAULT_OG_IMAGE = "/opengraph-image";
export const DEFAULT_TWITTER_IMAGE = "/twitter-image";

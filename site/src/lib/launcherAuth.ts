import { timingSafeEqual } from "node:crypto";

// Comparaison en temps constant du secret partage avec le launcher — une
// comparaison de chaine standard (`===`) fuit un signal temporel exploitable
// en theorie sur le nombre de caracteres corrects avant la premiere
// difference. timingSafeEqual exige des buffers de meme longueur, d'ou le
// contrôle de longueur avant l'appel plutôt que de le laisser lever.
export function isAuthorizedLauncherRequest(request: Request): boolean {
  const secret = process.env.LAUNCHER_API_KEY;
  if (!secret) return false;

  const authHeader = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;

  const actualBuffer = Buffer.from(authHeader);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length) return false;

  return timingSafeEqual(actualBuffer, expectedBuffer);
}

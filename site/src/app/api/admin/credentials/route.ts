import { NextResponse } from "next/server";
import { db } from "@/prisma/db";
import { hashPassword, passwordProblem, verifyPassword } from "@/lib/adminAuth";
import { getCurrentAdmin } from "@/lib/adminSession";
import { rateLimitResponse } from "@/lib/rateLimit";

// Changement du nom d'utilisateur et du mot de passe (première connexion obligatoire,
// ou paramètres ensuite). Demande toujours le mot de passe actuel.
const USERNAME_PATTERN = /^[a-zA-Z0-9_.-]{3,32}$/;

export async function POST(request: Request) {
  const limited = rateLimitResponse(request, "admin-credentials", 10);
  if (limited) return limited;
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "Connexion requise." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const currentPassword = String(body?.currentPassword ?? "");
  const username = String(body?.username ?? "").trim();
  const newPassword = String(body?.newPassword ?? "");

  if (!USERNAME_PATTERN.test(username)) {
    return NextResponse.json({ error: "Nom d'utilisateur : 3 à 32 caractères (lettres, chiffres, _ . -)." }, { status: 400 });
  }
  if (username.toLowerCase() === "admin") {
    return NextResponse.json({ error: "Choisis un nom d'utilisateur différent de « admin »." }, { status: 400 });
  }
  const problem = passwordProblem(newPassword);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });

  const account = await db.orm.public.AdminAccount.select("passwordHash").where({ id: admin.id }).first();
  if (!account || !(await verifyPassword(currentPassword, account.passwordHash))) {
    return NextResponse.json({ error: "Mot de passe actuel incorrect." }, { status: 401 });
  }

  const taken = await db.orm.public.AdminAccount.select("id").where({ username }).first();
  if (taken && taken.id !== admin.id) {
    return NextResponse.json({ error: "Ce nom d'utilisateur est déjà pris." }, { status: 409 });
  }

  const passwordHash = await hashPassword(newPassword);
  const plan = db.raw.sql`UPDATE "adminAccount" SET "username" = ${username}, "passwordHash" = ${passwordHash}, "mustChangeCredentials" = false WHERE "id" = ${admin.id}`
    .affectedCount()
    .build();
  await db.runtime().execute(plan);
  return NextResponse.json({ ok: true });
}

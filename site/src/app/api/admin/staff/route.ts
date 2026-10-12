import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { adminForAction } from "@/lib/adminServers";
import { hashPassword, passwordProblem } from "@/lib/adminAuth";
import { rateLimitResponse } from "@/lib/rateLimit";

// Création d'un compte staff. mustChangeCredentials est forcé à 1 : le nouveau membre choisit
// son propre nom d'utilisateur et mot de passe à la première connexion (voir premiere-connexion/).
// Pas de système d'email ici : le mot de passe initial est choisi par l'admin qui crée le compte,
// et communiqué au nouveau membre en dehors du site.
const USERNAME_PATTERN = /^[a-zA-Z0-9_.-]{3,32}$/;

export async function POST(request: Request) {
  const limited = rateLimitResponse(request, "admin-staff-create", 20);
  if (limited) return limited;
  const admin = await adminForAction(request);
  if (admin instanceof NextResponse) return admin;

  const form = await request.formData();
  const username = String(form.get("username") ?? "").trim();
  const role = String(form.get("role") ?? "");
  const initialPassword = String(form.get("initialPassword") ?? "");

  if (!USERNAME_PATTERN.test(username)) {
    return NextResponse.json({ error: "Nom d'utilisateur : 3 à 32 caractères (lettres, chiffres, _ . -)." }, { status: 400 });
  }
  if (role !== "admin" && role !== "moderator") {
    return NextResponse.json({ error: "Rôle invalide." }, { status: 400 });
  }
  const problem = passwordProblem(initialPassword);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });

  const taken = await db.orm.public.AdminAccount.select("id").where({ username }).first();
  if (taken) return NextResponse.json({ error: "Ce nom d'utilisateur est déjà pris." }, { status: 409 });

  const passwordHash = await hashPassword(initialPassword);
  await db.orm.public.AdminAccount.create({ username, passwordHash, role, mustChangeCredentials: true });

  return NextResponse.redirect(new URL(`/admin/servers?created=${encodeURIComponent(username)}`, request.url), 303);
}

import { NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/adminSession";
import { SOURCES, allSourceStates, setSourceEnabled, type Source } from "@/lib/platformSettings";

// Interrupteurs des sources de modpacks. Réservé aux admins (pas aux modérateurs)
// et seulement une fois les identifiants changés.
export async function GET() {
  const admin = await getCurrentAdmin();
  if (!admin || admin.mustChangeCredentials) return NextResponse.json({ error: "Connexion requise." }, { status: 401 });
  return NextResponse.json({ sources: await allSourceStates() });
}

export async function POST(request: Request) {
  const admin = await getCurrentAdmin();
  if (!admin || admin.mustChangeCredentials) return NextResponse.json({ error: "Connexion requise." }, { status: 401 });
  if (admin.role !== "admin") return NextResponse.json({ error: "Action réservée aux administrateurs." }, { status: 403 });

  const body = await request.json().catch(() => null);
  const source = String(body?.source ?? "") as Source;
  if (!SOURCES.includes(source) || typeof body?.enabled !== "boolean") {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }
  await setSourceEnabled(source, body.enabled);
  return NextResponse.json({ ok: true, sources: await allSourceStates() });
}

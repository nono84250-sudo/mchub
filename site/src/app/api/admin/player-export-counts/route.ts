import { NextResponse } from "next/server";
import { adminForAction } from "@/lib/adminServers";
import { countPlayerData } from "@/lib/playerExport";

// Chiffres de la fenêtre « Récupérer les données du joueur » (fiche joueur admin), demandés à
// l'ouverture de la fenêtre seulement (audit quota D1, 23/10 : avant, une dizaine de lectures
// à chaque affichage de la fiche). POST pour passer par la garde anti-CSRF d'adminForAction
// (en-tête Origin), réservé au rôle admin comme l'export lui-même.
export async function POST(request: Request) {
  const admin = await adminForAction(request);
  if (admin instanceof NextResponse) return admin;
  const body = (await request.json().catch(() => null)) as { id?: unknown } | null;
  const id = typeof body?.id === "string" ? body.id : "";
  if (!id) return NextResponse.json({ error: "Joueur introuvable." }, { status: 404 });
  const counts = await countPlayerData(id);
  return NextResponse.json({ counts }, { headers: { "Cache-Control": "no-store" } });
}

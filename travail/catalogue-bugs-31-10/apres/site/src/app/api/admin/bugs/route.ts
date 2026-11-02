import { NextResponse } from "next/server";
import { adminForAction } from "@/lib/adminServers";
import { createBug, listBugsForAdmin } from "@/lib/bugCatalog";

// Catalogue de bugs (page /admin/bugs) : créer une fiche. Même contrôle que les autres actions du panel.
export async function POST(request: Request) {
  const admin = await adminForAction(request);
  if (admin instanceof NextResponse) return admin;
  const result = await createBug(await request.json().catch(() => null));
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true, id: result.id, entries: await listBugsForAdmin() });
}

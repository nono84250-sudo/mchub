import { NextResponse } from "next/server";
import { adminForAction } from "@/lib/adminServers";
import { deleteBug, listBugsForAdmin, setBugPublished, updateBug } from "@/lib/bugCatalog";

type Ctx = { params: Promise<{ id: string }> };

// Catalogue de bugs (page /admin/bugs) : enregistrer, publier ou repasser en brouillon, supprimer.
export async function PUT(request: Request, { params }: Ctx) {
  const admin = await adminForAction(request);
  if (admin instanceof NextResponse) return admin;
  const { id } = await params;
  const result = await updateBug(id, await request.json().catch(() => null));
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true, id, entries: await listBugsForAdmin() });
}

export async function PATCH(request: Request, { params }: Ctx) {
  const admin = await adminForAction(request);
  if (admin instanceof NextResponse) return admin;
  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (typeof body?.published !== "boolean") return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  await setBugPublished(id, body.published);
  return NextResponse.json({ ok: true, id, entries: await listBugsForAdmin() });
}

export async function DELETE(request: Request, { params }: Ctx) {
  const admin = await adminForAction(request);
  if (admin instanceof NextResponse) return admin;
  const { id } = await params;
  await deleteBug(id);
  return NextResponse.json({ ok: true, entries: await listBugsForAdmin() });
}

import { NextResponse } from "next/server";
import { adminForAction } from "@/lib/adminServers";
import { normalizeMinecraftUuid } from "@/lib/launcherAuth";
import { FEATURE_STATES, FEATURES, getLabForAdmin, setFeatureStates, setTesters, type FeatureState, type Tester } from "@/lib/features";

// Laboratoire (/admin/laboratoire, 25/10) : changer l'état des fonctionnalités, ajouter ou retirer
// un compte testeur. Administrateurs seulement, même contrôle d'origine que les autres actions.
// Corps JSON : { states: { <id>: <état> } } | { addTester: "<pseudo>" } | { removeTester: "<uuid>" }.
export async function POST(request: Request) {
  const admin = await adminForAction(request);
  if (admin instanceof NextResponse) return admin;
  const body = await request.json().catch(() => null);

  if (body?.states && typeof body.states === "object") {
    const changes: Record<string, FeatureState> = {};
    for (const [id, state] of Object.entries(body.states as Record<string, unknown>)) {
      if (!FEATURES.some((f) => f.id === id) || !(FEATURE_STATES as readonly unknown[]).includes(state)) {
        return NextResponse.json({ error: "État inconnu." }, { status: 400 });
      }
      changes[id] = state as FeatureState;
    }
    await setFeatureStates(changes);
    return NextResponse.json({ ok: true, lab: await getLabForAdmin() });
  }

  if (typeof body?.addTester === "string") {
    const name = body.addTester.trim();
    if (!/^[A-Za-z0-9_]{3,16}$/.test(name)) return NextResponse.json({ error: "Pseudo Minecraft invalide." }, { status: 400 });
    // UUID vérifié auprès de Mojang : un pseudo mal tapé ne doit pas donner l'accès à un autre joueur.
    const res = await fetch(`https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(name)}`, { signal: AbortSignal.timeout(8000) }).catch(() => null);
    if (!res) return NextResponse.json({ error: "Mojang ne répond pas, réessaie dans un instant." }, { status: 503 });
    if (res.status === 404 || res.status === 204) return NextResponse.json({ error: "Aucun compte Minecraft avec ce pseudo." }, { status: 404 });
    const profile = (await res.json().catch(() => null)) as { id?: string; name?: string } | null;
    if (!res.ok || !profile?.id) return NextResponse.json({ error: "Mojang ne répond pas, réessaie dans un instant." }, { status: 503 });
    const { testers } = await getLabForAdmin();
    const uuid = normalizeMinecraftUuid(profile.id);
    if (!testers.some((t) => normalizeMinecraftUuid(t.uuid) === uuid)) {
      await setTesters([...testers, { uuid, name: profile.name ?? name }]);
    }
    return NextResponse.json({ ok: true, lab: await getLabForAdmin() });
  }

  if (typeof body?.removeTester === "string") {
    const uuid = normalizeMinecraftUuid(body.removeTester);
    const { testers } = await getLabForAdmin();
    await setTesters(testers.filter((t: Tester) => normalizeMinecraftUuid(t.uuid) !== uuid));
    return NextResponse.json({ ok: true, lab: await getLabForAdmin() });
  }

  return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
}

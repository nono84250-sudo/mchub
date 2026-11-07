import { NextResponse } from "next/server";
import { adminForAction } from "@/lib/adminServers";
import { normalizeMinecraftUuid } from "@/lib/launcherAuth";
import { execSql } from "@/lib/db";
import { FEATURE_STATES, FEATURES, getLabForAdmin, setFeatureStates, setTesters, type FeatureState, type Tester } from "@/lib/features";

// Laboratoire (/admin/laboratoire, 25/10) : changer l'état des fonctionnalités, ajouter ou retirer
// un compte testeur. Administrateurs seulement, même contrôle d'origine que les autres actions.
// Corps JSON : { states: { <id>: <état> } } | { searchPlayers: "<début du pseudo>" }
//   | { addTester: "<uuid d'un joueur inscrit>" } | { removeTester: "<uuid>" }.
// 06/11 : on ne tape plus un pseudo Minecraft libre. L'admin cherche parmi les joueurs INSCRITS
// sur Omniscient (table "user") et ne peut ajouter que l'un d'eux. Pseudos visibles par les admins seulement.
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

  if (typeof body?.searchPlayers === "string") {
    const q = body.searchPlayers.trim();
    if (!/^[A-Za-z0-9_]{2,16}$/.test(q)) return NextResponse.json({ players: [] });
    // "_" est un joker dans LIKE : on l'échappe pour chercher le vrai caractère.
    const rows = (await execSql(
      `SELECT "minecraftUuid", "minecraftUsername", "createdAt" FROM "user"
       WHERE "minecraftUuid" IS NOT NULL AND "minecraftUsername" LIKE ? ESCAPE '\\'
       ORDER BY "minecraftUsername" COLLATE NOCASE ASC LIMIT 8`,
      [q.replaceAll("_", "\\_") + "%"],
    )) as { minecraftUuid: string; minecraftUsername: string | null; createdAt: string }[];
    const players = rows
      .filter((r) => r.minecraftUsername)
      .map((r) => ({ uuid: normalizeMinecraftUuid(r.minecraftUuid), name: r.minecraftUsername as string, createdAt: r.createdAt }));
    return NextResponse.json({ players });
  }

  if (typeof body?.addTester === "string") {
    const uuid = normalizeMinecraftUuid(body.addTester.trim());
    if (!/^[0-9a-f]{32}$/.test(uuid)) return NextResponse.json({ error: "Choisis un joueur dans la liste." }, { status: 400 });
    // Seul un joueur inscrit sur Omniscient peut devenir testeur (plus de pseudo tapé au hasard).
    const rows = (await execSql('SELECT "minecraftUsername" FROM "user" WHERE "minecraftUuid" = ? LIMIT 1', [uuid])) as { minecraftUsername: string | null }[];
    const name = rows[0]?.minecraftUsername;
    if (!name) return NextResponse.json({ error: "Ce joueur n'est pas inscrit sur Omniscient." }, { status: 404 });
    const { testers } = await getLabForAdmin();
    if (!testers.some((t) => normalizeMinecraftUuid(t.uuid) === uuid)) {
      await setTesters([...testers, { uuid, name }]);
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

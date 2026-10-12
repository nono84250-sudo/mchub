import { NextResponse } from "next/server";
import { processDueScheduledBroadcasts } from "@/lib/scheduledBroadcasts";

// Appelee toutes les quelques minutes par un petit Worker Cloudflare (voir cron-worker/),
// jamais directement par un navigateur. Vercel Hobby ne permet qu'une tache planifiee par
// jour (insuffisant pour une heure precise) — Cloudflare, lui, descend a la minute, meme
// gratuit. Protegee par un secret partage, pas par LAUNCHER_API_KEY (ce n'est pas le launcher
// qui appelle).
export async function POST(request: Request) {
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== expected) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  const sent = await processDueScheduledBroadcasts();
  return NextResponse.json({ ok: true, sent });
}

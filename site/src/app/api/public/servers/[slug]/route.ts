import { NextResponse } from "next/server";
import { getPublicServerBySlug } from "@/lib/public-servers";

export const revalidate = 60;

const CORS_HEADERS = { "Access-Control-Allow-Origin": "*" };

export async function GET(_request: Request, ctx: RouteContext<"/api/public/servers/[slug]">) {
  const { slug } = await ctx.params;
  const server = await getPublicServerBySlug(slug);

  if (!server) {
    return NextResponse.json({ error: "Serveur introuvable" }, { status: 404, headers: CORS_HEADERS });
  }

  return NextResponse.json({ server }, { headers: CORS_HEADERS });
}

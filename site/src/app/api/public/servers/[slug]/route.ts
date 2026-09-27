import { NextResponse } from "next/server";
import { getPublicServerBySlug } from "@/lib/public-servers";
import { rateLimitResponse } from "@/lib/rateLimit";

export const revalidate = 60;

const CORS_HEADERS = { "Access-Control-Allow-Origin": "*" };

export async function GET(request: Request, ctx: RouteContext<"/api/public/servers/[slug]">) {
  const limited = rateLimitResponse(request, "public-server", 120, { headers: CORS_HEADERS });
  if (limited) return limited;

  const { slug } = await ctx.params;
  const server = await getPublicServerBySlug(slug);

  if (!server) {
    return NextResponse.json({ error: "Serveur introuvable" }, { status: 404, headers: CORS_HEADERS });
  }

  return NextResponse.json({ server }, { headers: CORS_HEADERS });
}

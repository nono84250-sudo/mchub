import { NextResponse } from "next/server";
import { adminForAction, backToServers } from "@/lib/adminServers";
import { dismissBehaviorReport } from "@/lib/reports";

export async function POST(request: Request, ctx: RouteContext<"/api/admin/reports/[id]/dismiss">) {
  const admin = await adminForAction(request);
  if (admin instanceof NextResponse) return admin;
  const { id } = await ctx.params;
  await dismissBehaviorReport(id);
  return backToServers(request, "/admin/reports");
}

import { DesignScreen } from "@/components/admin/DesignScreen";
import { requireAdmin } from "@/app/admin/design/guard";

export const dynamic = "force-dynamic";

export default async function ServerDetail() {
  await requireAdmin();
  return <DesignScreen name="server-detail" markAll />;
}

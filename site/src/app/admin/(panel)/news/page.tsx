import { DesignScreen } from "@/components/admin/DesignScreen";
import { requireAdmin } from "@/app/admin/design/guard";

export const dynamic = "force-dynamic";

export default async function News() {
  await requireAdmin();
  return <DesignScreen name="news" />;
}

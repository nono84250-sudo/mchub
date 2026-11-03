import { redirect } from "next/navigation";

// « Mes mondes » est devenu l'onglet Mondes de « Mon cloud » (03/11) : les anciens liens y mènent.
export default function MondesPage() {
  redirect("/dashboard/cloud?tab=worlds");
}

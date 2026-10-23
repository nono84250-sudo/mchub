"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { markMyNotificationsReadAction } from "@/lib/actions/notifications";

// Monte sur /dashboard/notifications quand il y a des non-lues : la page s'affiche d'abord avec
// les nouvelles mises en avant, puis tout est marque comme lu et la pastille disparait.
export function MarkNotificationsRead() {
  const router = useRouter();
  useEffect(() => {
    markMyNotificationsReadAction().then(() => router.refresh());
  }, [router]);
  return null;
}

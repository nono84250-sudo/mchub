"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SquaresFour, Bell, Newspaper } from "@phosphor-icons/react";
import type { Icon as PhosphorIcon } from "@phosphor-icons/react";
import { useI18n } from "@/i18n/I18nProvider";

export function DashboardNav() {
  const pathname = usePathname();
  const { t } = useI18n();

  const NAV_ITEMS: { href: string; label: string; icon: PhosphorIcon }[] = [
    { href: "/dashboard", label: t("dashboard.navServers"), icon: SquaresFour },
    { href: "/dashboard/notifications", label: t("dashboard.navNotifications"), icon: Bell },
    { href: "/dashboard/news", label: t("dashboard.navNews"), icon: Newspaper },
  ];

  return (
    <nav className="flex w-12 flex-shrink-0 flex-col items-center gap-1 sm:w-48 sm:items-stretch">
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            title={label}
            className={`flex items-center justify-center gap-2 rounded-lg px-2 py-2 text-sm transition-colors sm:justify-start sm:px-3 ${
              active ? "bg-surface text-foreground" : "text-muted hover:bg-surface hover:text-foreground"
            }`}
          >
            <Icon className="h-4 w-4 flex-shrink-0" />
            <span className="hidden sm:inline">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

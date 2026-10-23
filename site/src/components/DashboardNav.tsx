"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SquaresFour, Bell, Newspaper, Gear, Users, UsersThree } from "@phosphor-icons/react";
import type { Icon as PhosphorIcon } from "@phosphor-icons/react";
import { useI18n } from "@/i18n/I18nProvider";
import { UnreadBadge } from "@/components/UnreadBadge";
import { TEAMS_READY } from "@/lib/teamRules";

export function DashboardNav({ unread = 0 }: { unread?: number }) {
  const pathname = usePathname();
  const { t } = useI18n();

  const NAV_ITEMS: { href: string; label: string; icon: PhosphorIcon }[] = [
    { href: "/dashboard", label: t("dashboard.navHome"), icon: SquaresFour },
    { href: "/dashboard/notifications", label: t("dashboard.navNotifications"), icon: Bell },
    { href: "/dashboard/amis", label: t("dashboard.navFriends"), icon: Users },
    // Teams (19/10) : entre Amis et Actualites (choix de Rushi).
    ...(TEAMS_READY ? [{ href: "/dashboard/team", label: t("dashboard.navTeam"), icon: UsersThree }] : []),
    { href: "/dashboard/news", label: t("dashboard.navNews"), icon: Newspaper },
    { href: "/dashboard/parametres", label: t("dashboard.navSettings"), icon: Gear },
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
            <span className="hidden flex-1 sm:inline">{label}</span>
            {href === "/dashboard/notifications" ? <UnreadBadge count={unread} className="hidden sm:inline-grid" /> : null}
          </Link>
        );
      })}
    </nav>
  );
}

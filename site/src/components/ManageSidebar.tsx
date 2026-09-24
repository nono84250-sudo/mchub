"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Layout, ChartBar, Flag, Gear } from "@phosphor-icons/react";
import type { Icon as PhosphorIcon } from "@phosphor-icons/react";
import { useI18n } from "@/i18n/I18nProvider";

export function ManageSidebar({
  serverId,
  serverName,
  openReportsCount,
}: {
  serverId: string;
  serverName: string;
  openReportsCount: number;
}) {
  const pathname = usePathname();
  const { t } = useI18n();

  const navItems: { href: string; label: string; icon: PhosphorIcon; badge?: number }[] = [
    { href: `/manage/${serverId}`, label: t("manage.navOverview"), icon: Layout },
    { href: `/manage/${serverId}/activity`, label: t("manage.navActivity"), icon: ChartBar },
    { href: `/manage/${serverId}/reports`, label: t("manage.navReports"), icon: Flag, badge: openReportsCount },
    { href: `/manage/${serverId}/settings`, label: t("manage.navSettings"), icon: Gear },
  ];

  return (
    <nav className="flex w-14 flex-shrink-0 flex-col items-center gap-1 border-r border-border bg-surface/60 p-2 sm:w-56 sm:items-stretch sm:p-4">
      <Link
        href="/dashboard"
        title={t("manage.backToDashboard")}
        className="mb-4 flex items-center gap-2 rounded-lg px-0 py-1 hover:bg-surface-raised sm:px-2"
      >
        <span className="server-icon h-8 w-8 flex-shrink-0 text-sm">{serverName.trim().charAt(0).toUpperCase() || "?"}</span>
        <span className="hidden min-w-0 truncate font-medium text-foreground sm:inline">{serverName}</span>
      </Link>

      {navItems.map(({ href, label, icon: Icon, badge }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            title={label}
            className={`flex items-center justify-center gap-2 rounded-lg px-2 py-2 text-sm transition-colors sm:justify-start sm:px-3 ${
              active ? "bg-surface-raised text-foreground" : "text-muted hover:bg-surface-raised hover:text-foreground"
            }`}
          >
            <Icon className="h-4 w-4 flex-shrink-0" />
            <span className="hidden min-w-0 flex-1 truncate sm:inline">{label}</span>
            {badge ? (
              <span
                className="hidden flex-shrink-0 rounded-full px-1.5 text-[11px] font-semibold sm:inline"
                style={{ background: "color-mix(in srgb, var(--danger) 18%, transparent)", color: "var(--danger)" }}
              >
                {badge}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

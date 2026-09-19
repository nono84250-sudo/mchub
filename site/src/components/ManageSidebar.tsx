"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Settings } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export function ManageSidebar({ serverId, serverName }: { serverId: string; serverName: string }) {
  const pathname = usePathname();

  const navItems: { href: string; label: string; icon: LucideIcon }[] = [
    { href: `/manage/${serverId}`, label: "Vue d'ensemble", icon: LayoutDashboard },
    { href: `/manage/${serverId}/settings`, label: "Paramètres", icon: Settings },
  ];

  return (
    <nav className="flex w-56 flex-shrink-0 flex-col gap-1 border-r border-border bg-surface/60 p-4">
      <div className="mb-4 flex items-center gap-2 px-2">
        <span className="server-icon h-8 w-8 text-sm">{serverName.trim().charAt(0).toUpperCase() || "?"}</span>
        <span className="min-w-0 truncate font-medium text-foreground">{serverName}</span>
      </div>

      {navItems.map(({ href, label, icon: Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
              active ? "bg-surface-raised text-foreground" : "text-muted hover:bg-surface-raised hover:text-foreground"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

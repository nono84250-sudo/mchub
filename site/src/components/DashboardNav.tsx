"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, Bell, Newspaper } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const NAV_ITEMS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/dashboard", label: "Serveurs", icon: LayoutGrid },
  { href: "/dashboard/notifications", label: "Notifications", icon: Bell },
  { href: "/dashboard/news", label: "Actualités", icon: Newspaper },
];

export function DashboardNav() {
  const pathname = usePathname();

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

"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, LogOut, Menu, MessageCircle } from "lucide-react";
import { logoutAction } from "@/server/actions/auth";
import type { UserRole } from "@/lib/roles";
import {
  MobileBottomNav,
  MobileMoreMenu,
  SideNav,
  type NavBadges,
} from "@/components/erp-nav";
import { clusterForPath, linkForPath } from "@/lib/flow";
import { cn } from "@/lib/utils";

export type ShellAlert = {
  label: string;
  count: number;
  href: string;
  tone: "danger" | "warn" | "info";
};

export function ErpShell({
  user,
  children,
  whatsappProvider = "stub",
  badges = {},
  alerts = [],
}: {
  user: { name: string; email: string; role: UserRole };
  children: React.ReactNode;
  whatsappProvider?: string;
  badges?: NavBadges;
  alerts?: ShellAlert[];
}) {
  const [moreOpen, setMoreOpen] = useState(false);
  const pathname = usePathname();
  const waLive = whatsappProvider === "meta";
  const cluster = clusterForPath(pathname);
  const link = linkForPath(pathname);
  const liveAlerts = alerts.filter((a) => a.count > 0);

  return (
    <div className="min-h-screen text-(--ink)">
      <div className="flex min-h-screen">
        <aside className="sticky top-0 hidden h-screen w-49 shrink-0 flex-col border-r border-white/5 bg-(--sidebar) text-(--sidebar-ink) md:flex">
          <Link
            href="/dashboard"
            className="border-b border-white/10 px-3 py-3 transition hover:bg-white/5"
          >
            <p className="font-serif text-[19px] leading-none tracking-tight text-white">
              Mapps
            </p>
            <p className="mt-1 text-[9.5px] font-medium tracking-[0.14em] text-(--sidebar-muted) uppercase">
              Creation · RFD ERP
            </p>
          </Link>

          <SideNav badges={badges} />

          <div className="mt-auto space-y-2 border-t border-white/10 px-3 py-2.5">
            <Link
              href="/messages"
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold transition",
                waLive
                  ? "bg-[#128c7e]/25 text-[#7ddec8] hover:bg-[#128c7e]/40"
                  : "bg-white/5 text-(--sidebar-muted) hover:bg-white/10",
              )}
            >
              <MessageCircle className="h-3 w-3" />
              {waLive ? "WhatsApp live" : "WhatsApp stub"}
            </Link>
            <div>
              <p className="truncate text-[12px] font-medium text-white">
                {user.name}
              </p>
              <p className="truncate text-[10px] text-(--sidebar-muted)">
                {user.role}
              </p>
            </div>
            <form action={logoutAction}>
              <button
                type="submit"
                className="inline-flex items-center gap-1 text-[11px] text-(--sidebar-muted) transition hover:text-white"
              >
                <LogOut className="h-3 w-3" />
                Sign out
              </button>
            </form>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-11 items-center justify-between gap-2 border-b border-(--line) bg-(--panel)/92 px-3 backdrop-blur sm:px-4">
            <div className="flex min-w-0 items-center gap-2">
              <button
                type="button"
                onClick={() => setMoreOpen(true)}
                className="rounded-md border border-(--line) p-1.5 md:hidden"
                aria-label="Open menu"
              >
                <Menu className="h-3.5 w-3.5" />
              </button>
              <div className="flex min-w-0 items-center gap-1 text-[11.5px]">
                <span className="font-serif text-[14px] md:hidden">Mapps</span>
                {cluster ? (
                  <span className="hidden font-semibold tracking-wide text-(--muted) uppercase md:inline">
                    {cluster.title}
                  </span>
                ) : null}
                {cluster && link ? (
                  <ChevronRight className="hidden h-3 w-3 text-(--faint) md:inline" />
                ) : null}
                {link ? (
                  <span className="hidden truncate font-semibold text-(--ink) md:inline">
                    {link.label}
                  </span>
                ) : null}
              </div>
            </div>

            <div className="flex min-w-0 items-center gap-1.5">
              {liveAlerts.map((alert) => (
                <Link
                  key={alert.href + alert.label}
                  href={alert.href}
                  className={cn(
                    "badge transition hover:brightness-95",
                    alert.tone === "danger"
                      ? "badge-danger"
                      : alert.tone === "warn"
                        ? "badge-warn"
                        : "badge-info",
                  )}
                >
                  {alert.count} {alert.label}
                </Link>
              ))}
              <p className="hidden truncate text-right text-[11px] text-(--muted) lg:block">
                {user.email}
              </p>
            </div>
          </header>

          <main className="animate-fade-up flex-1 px-3 py-3 pb-20 sm:px-4 md:pb-5">
            {children}
          </main>
        </div>
      </div>

      <MobileBottomNav onMore={() => setMoreOpen(true)} />
      <MobileMoreMenu open={moreOpen} onClose={() => setMoreOpen(false)} />
    </div>
  );
}

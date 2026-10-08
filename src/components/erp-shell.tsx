"use client";

import { cn } from "@/lib/utils";
import type { ShellFlow } from "@/lib/shell-flow";
import type { UserRole } from "@/lib/roles";
import {
  MobileBottomNav,
  MobileMoreMenu,
  SideNav,
  type NavBadges,
} from "@/components/erp-nav";
import { clusterForPath, linkForPath } from "@/lib/flow";
import { logoutAction } from "@/server/actions/auth";
import { ChevronLeft, ChevronRight, LogOut, Menu, MessageCircle } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, use, useEffect, useState } from "react";

const SIDEBAR_KEY = "mapps.sidebar.collapsed";

export type ShellAlert = {
  label: string;
  count: number;
  href: string;
  tone: "danger" | "warn" | "info";
};

function badgesFromFlow(flow: ShellFlow): NavBadges {
  return {
    "/returns": flow.grQcPending + flow.millRfOpen,
    "/dispatch": flow.delivery.queue,
    "/payments": flow.payment.alert,
  };
}

function alertsFromFlow(flow: ShellFlow): ShellAlert[] {
  return [
    {
      label: "RF overdue",
      count: flow.millRfOverdue,
      href: "/returns",
      tone: "danger" as const,
    },
    {
      label: "past due",
      count: flow.payment.alert,
      href: "/payments",
      tone: "danger" as const,
    },
  ].filter((a) => a.count > 0);
}

function LiveSideNav({
  flowPromise,
  collapsed,
}: {
  flowPromise: Promise<ShellFlow>;
  collapsed: boolean;
}) {
  const flow = use(flowPromise);
  return <SideNav badges={badgesFromFlow(flow)} collapsed={collapsed} />;
}

function LiveHeaderAlerts({
  flowPromise,
}: {
  flowPromise: Promise<ShellFlow>;
}) {
  const flow = use(flowPromise);
  const liveAlerts = alertsFromFlow(flow);
  if (liveAlerts.length === 0) return null;

  return (
    <>
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
    </>
  );
}

export function ErpShell({
  user,
  children,
  whatsappProvider = "stub",
  flowPromise,
}: {
  user: { name: string; email: string; role: UserRole };
  children: React.ReactNode;
  whatsappProvider?: string;
  flowPromise: Promise<ShellFlow>;
}) {
  const [moreOpen, setMoreOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setCollapsed(window.localStorage.getItem(SIDEBAR_KEY) === "1");
  }, []);

  function toggleSidebar() {
    setCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem(SIDEBAR_KEY, next ? "1" : "0");
      return next;
    });
  }
  const hideSidebar = pathname === "/menu";
  const textileHeader =
    pathname === "/grey" ||
    pathname === "/programs" ||
    pathname === "/inward" ||
    pathname === "/qc" ||
    pathname === "/stock";
  const darkHeader = hideSidebar;
  const waLive = whatsappProvider === "meta";
  const cluster = clusterForPath(pathname);
  const link = linkForPath(pathname);

  return (
    <div className="erp-shell min-h-screen text-(--ink)">
      <div className="flex min-h-screen">
        {hideSidebar ? null : (
        <aside
          className={cn(
            "no-print sticky top-0 hidden h-screen shrink-0 flex-col overflow-hidden border-r border-white/6 bg-(--sidebar) text-(--sidebar-ink) transition-[width] duration-200 ease-out md:flex",
            collapsed ? "w-[3.25rem]" : "w-52",
          )}
        >
          <div
            className={cn(
              "relative border-b border-white/8",
              collapsed ? "px-1.5 py-2" : "px-3.5 py-3.5",
            )}
          >
            <span className="absolute inset-x-3 top-0 h-px bg-linear-to-r from-transparent via-[#c9a227]/70 to-transparent opacity-80" />
            <div className={cn("flex items-center", collapsed ? "justify-center" : "gap-2.5 pr-7")}>
              <Link
                href="/dashboard"
                title={collapsed ? "Mapps" : undefined}
                className="group flex min-w-0 items-center gap-2.5 rounded-md transition hover:bg-white/[0.04]"
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-[#c9a227]/55 bg-linear-to-br from-[#2a241c] to-[#0c0a08] font-serif text-[11px] font-bold tracking-wide text-[#e8c547] shadow-[0_0_0_1px_rgba(201,162,39,0.12)]">
                  MC
                </span>
                {collapsed ? null : (
                  <span className="min-w-0">
                    <span className="block font-serif text-[18px] leading-none tracking-tight text-white">
                      Mapps
                    </span>
                    <span className="mt-1 block text-[9px] font-semibold tracking-[0.16em] text-(--sidebar-muted) uppercase">
                      Creation · RFD
                    </span>
                  </span>
                )}
              </Link>
            </div>
            <button
              type="button"
              onClick={toggleSidebar}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-expanded={!collapsed}
              className={cn(
                "grid h-7 w-7 place-items-center rounded-md text-(--sidebar-muted) transition hover:bg-white/10 hover:text-white",
                collapsed ? "mx-auto mt-1.5" : "absolute top-2.5 right-2",
              )}
            >
              {collapsed ? (
                <ChevronRight className="h-3.5 w-3.5" />
              ) : (
                <ChevronLeft className="h-3.5 w-3.5" />
              )}
            </button>
          </div>

          <Suspense fallback={<SideNav badges={{}} collapsed={collapsed} />}>
            <LiveSideNav flowPromise={flowPromise} collapsed={collapsed} />
          </Suspense>

          <div
            className={cn(
              "mt-auto border-t border-white/8",
              collapsed
                ? "flex flex-col items-center gap-2 px-1 py-2"
                : "space-y-2.5 px-3 py-3",
            )}
          >
            <Link
              href="/messages"
              title={collapsed ? (waLive ? "WhatsApp live" : "WhatsApp stub") : undefined}
              className={cn(
                "inline-flex items-center text-[10px] font-semibold transition",
                collapsed ? "grid h-8 w-8 place-items-center rounded-md" : "gap-1.5 rounded-full px-2 py-0.5",
                waLive
                  ? "bg-[#128c7e]/25 text-[#7ddec8] hover:bg-[#128c7e]/40"
                  : "bg-white/5 text-(--sidebar-muted) hover:bg-white/10",
              )}
            >
              <MessageCircle className="h-3 w-3" />
              {collapsed ? null : waLive ? "WhatsApp live" : "WhatsApp stub"}
            </Link>
            {collapsed ? (
              <span
                title={`${user.name} · ${user.role}`}
                className="grid h-7 w-7 place-items-center rounded-full bg-white/10 text-[10px] font-semibold text-white"
              >
                {user.name.slice(0, 1).toUpperCase()}
              </span>
            ) : (
              <div>
                <p className="truncate text-[12px] font-medium text-white">
                  {user.name}
                </p>
                <p className="truncate text-[10px] tracking-wide text-(--sidebar-muted)">
                  {user.role}
                </p>
              </div>
            )}
            <form action={logoutAction}>
              <button
                type="submit"
                title={collapsed ? "Sign out" : undefined}
                aria-label={collapsed ? "Sign out" : undefined}
                className={cn(
                  "inline-flex items-center text-[11px] text-(--sidebar-muted) transition hover:text-white",
                  collapsed ? "grid h-8 w-8 place-items-center rounded-md hover:bg-white/10" : "gap-1",
                )}
              >
                <LogOut className="h-3 w-3" />
                {collapsed ? null : "Sign out"}
              </button>
            </form>
          </div>
        </aside>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <header
            className={cn(
              "no-print sticky top-0 z-30 flex h-12 items-center justify-between gap-2 px-3 sm:px-4",
              hideSidebar
                ? "menu-app-header"
                : textileHeader
                  ? "tx-app-header"
                  : "border-b border-(--line) bg-(--panel)/90 backdrop-blur-md",
            )}
          >
            <div className="flex min-w-0 items-center gap-2">
              {hideSidebar ? null : (
              <button
                type="button"
                onClick={() => setMoreOpen(true)}
                className="rounded-md border border-(--line) p-1.5 transition hover:bg-(--panel-sunken) md:hidden"
                aria-label="Open menu"
              >
                <Menu className="h-3.5 w-3.5" />
              </button>
              )}
              {darkHeader ? (
                <span className="font-serif text-[15px] text-[#f6efe2] md:hidden">
                  Mapps
                </span>
              ) : (
              <div className="flex min-w-0 items-center gap-1 text-[11.5px]">
                <span className="font-serif text-[15px] md:hidden">Mapps</span>
                {cluster ? (
                  <span className="hidden font-semibold tracking-[0.12em] text-(--muted) uppercase md:inline">
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
              )}
            </div>
            {darkHeader ? (
              <div className="menu-app-crumb hidden md:flex">
                {cluster ? (
                  <span className="font-semibold tracking-[0.12em] uppercase">
                    {cluster.title}
                  </span>
                ) : null}
                {cluster && link ? (
                  <ChevronRight className="h-3 w-3 opacity-55" />
                ) : null}
                {link ? (
                  <span className="truncate font-semibold">{link.label}</span>
                ) : null}
              </div>
            ) : null}

            <div className="flex min-w-0 items-center gap-1.5">
              <Suspense fallback={null}>
                <LiveHeaderAlerts flowPromise={flowPromise} />
              </Suspense>
              <p className="hidden truncate text-right text-[11px] text-(--muted) lg:block">
                {user.email}
              </p>
            </div>
          </header>

          <main
            className={cn(
              "animate-fade-up flex-1 px-3 py-3.5 sm:px-4",
              hideSidebar ? "pb-5" : "pb-20 md:pb-5",
            )}
          >
            {children}
          </main>
        </div>
      </div>

      {hideSidebar ? null : (
      <div className="no-print">
        <MobileBottomNav onMore={() => setMoreOpen(true)} />
        <MobileMoreMenu open={moreOpen} onClose={() => setMoreOpen(false)} />
      </div>
      )}
    </div>
  );
}

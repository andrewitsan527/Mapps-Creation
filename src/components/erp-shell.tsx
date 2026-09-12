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
import { ChevronRight, LogOut, Menu, MessageCircle } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, use, useState } from "react";
import { SiteFooter } from "@/components/site-footer";

export type ShellAlert = {
  label: string;
  count: number;
  href: string;
  tone: "danger" | "warn" | "info";
};

function badgesFromFlow(flow: ShellFlow): NavBadges {
  return {
    "/qc": flow.qc.queue,
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
    {
      label: "weaver HIGH",
      count: flow.weaverHigh,
      href: "/qc",
      tone: "warn" as const,
    },
  ].filter((a) => a.count > 0);
}

function LiveSideNav({
  flowPromise,
}: {
  flowPromise: Promise<ShellFlow>;
}) {
  const flow = use(flowPromise);
  return <SideNav badges={badgesFromFlow(flow)} />;
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
  const pathname = usePathname();
  const waLive = whatsappProvider === "meta";
  const waClick = whatsappProvider === "click";
  const waLabel = waLive
    ? "WhatsApp live"
    : waClick
      ? "WhatsApp click"
      : "WhatsApp stub";
  const waClass = waLive
    ? "bg-[#128c7e]/25 text-[#7ddec8] hover:bg-[#128c7e]/40"
    : waClick
      ? "bg-[#128c7e]/15 text-[#5ec4b0] hover:bg-[#128c7e]/25"
      : "bg-white/5 text-(--sidebar-muted) hover:bg-white/10";
  const cluster = clusterForPath(pathname);
  const link = linkForPath(pathname);

  return (
    <div className="erp-shell min-h-screen text-(--ink)">
      <div className="flex min-h-screen">
        <aside className="no-print sticky top-0 hidden h-screen w-52 shrink-0 flex-col border-r border-white/6 bg-(--sidebar) text-(--sidebar-ink) md:flex">
          <Link
            href="/dashboard"
            className="group relative border-b border-white/8 px-3.5 py-3.5 transition hover:bg-white/[0.04]"
          >
            <span className="absolute inset-x-3 top-0 h-px bg-linear-to-r from-transparent via-[#c9a227]/70 to-transparent opacity-80" />
            <div className="flex items-center gap-2.5">
              <span className="grid h-8 w-8 place-items-center rounded-full border border-[#c9a227]/55 bg-linear-to-br from-[#2a241c] to-[#0c0a08] font-serif text-[11px] font-bold tracking-wide text-[#e8c547] shadow-[0_0_0_1px_rgba(201,162,39,0.12)]">
                MC
              </span>
              <div className="min-w-0">
                <p className="font-serif text-[18px] leading-none tracking-tight text-white">
                  Mapps
                </p>
                <p className="mt-1 text-[9px] font-semibold tracking-[0.16em] text-(--sidebar-muted) uppercase">
                  Creation · RFD
                </p>
              </div>
            </div>
          </Link>

          <Suspense fallback={<SideNav badges={{}} />}>
            <LiveSideNav flowPromise={flowPromise} />
          </Suspense>

          <div className="mt-auto space-y-2.5 border-t border-white/8 px-3 py-3">
            <Link
              href="/messages"
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold transition",
                waClass,
              )}
            >
              <MessageCircle className="h-3 w-3" />
              {waLabel}
            </Link>
            <div>
              <p className="truncate text-[12px] font-medium text-white">
                {user.name}
              </p>
              <p className="truncate text-[10px] tracking-wide text-(--sidebar-muted)">
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
          <header className="no-print sticky top-0 z-30 flex h-12 items-center justify-between gap-2 border-b border-(--line) bg-(--panel)/90 px-3 backdrop-blur-md sm:px-4">
            <div className="flex min-w-0 items-center gap-2">
              <button
                type="button"
                onClick={() => setMoreOpen(true)}
                className="rounded-md border border-(--line) p-1.5 transition hover:bg-(--panel-sunken) md:hidden"
                aria-label="Open menu"
              >
                <Menu className="h-3.5 w-3.5" />
              </button>
              <div className="flex min-w-0 items-center gap-1 text-[11.5px]">
                <span className="font-serif text-[15px] md:hidden">Mapps</span>
                {link ? (
                  <>
                    <ChevronRight className="h-3 w-3 shrink-0 text-(--faint) md:hidden" />
                    <span className="truncate font-semibold text-(--ink) md:hidden">
                      {link.label}
                    </span>
                  </>
                ) : null}
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
            </div>

            <div className="flex min-w-0 max-w-[48%] items-center gap-1 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:max-w-none sm:gap-1.5">
              <Suspense fallback={null}>
                <LiveHeaderAlerts flowPromise={flowPromise} />
              </Suspense>
              <p className="hidden truncate text-right text-[11px] text-(--muted) lg:block">
                {user.email}
              </p>
            </div>
          </header>

          <main className="page-enter flex-1 overflow-x-hidden px-2.5 py-3 sm:px-4 md:pb-4">
            {children}
          </main>
          <SiteFooter className="pb-[calc(4.75rem+env(safe-area-inset-bottom))] md:pb-2.5" />
        </div>
      </div>

      <div className="no-print">
        <MobileBottomNav onMore={() => setMoreOpen(true)} />
        <MobileMoreMenu open={moreOpen} onClose={() => setMoreOpen(false)} />
      </div>
    </div>
  );
}

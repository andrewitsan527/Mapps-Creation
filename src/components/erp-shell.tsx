"use client";

import { useState } from "react";
import { LogOut, Menu, MessageCircle } from "lucide-react";
import { logoutAction } from "@/server/actions/auth";
import type { UserRole } from "@/lib/roles";
import { MobileBottomNav, MobileMoreMenu, SideNav } from "@/components/erp-nav";

export function ErpShell({
  user,
  children,
  whatsappProvider = "stub",
}: {
  user: { name: string; email: string; role: UserRole };
  children: React.ReactNode;
  whatsappProvider?: string;
}) {
  const [moreOpen, setMoreOpen] = useState(false);
  const waLive = whatsappProvider === "meta";

  return (
    <div className="min-h-screen text-(--ink)">
      <div className="flex min-h-screen">
        <aside className="sticky top-0 hidden h-screen w-[188px] shrink-0 flex-col border-r border-white/5 bg-(--sidebar) text-(--sidebar-ink) md:flex">
          <div className="border-b border-white/10 px-3 py-3">
            <p className="font-serif text-[18px] leading-none tracking-tight text-white">
              Mapps
            </p>
            <p className="mt-1 text-[10px] font-medium tracking-[0.08em] text-(--sidebar-muted) uppercase">
              Creation · RFD ERP
            </p>
          </div>
          <SideNav />
          <div className="mt-auto space-y-2 border-t border-white/10 px-3 py-3">
            <div
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                waLive
                  ? "bg-[#128c7e]/25 text-[#7ddec8]"
                  : "bg-white/5 text-(--sidebar-muted)"
              }`}
            >
              <MessageCircle className="h-3 w-3" />
              {waLive ? "WA live" : "WA stub"}
            </div>
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
          <header className="sticky top-0 z-30 flex h-11 items-center justify-between gap-2 border-b border-(--line) bg-(--panel)/90 px-3 backdrop-blur sm:px-4">
            <div className="flex min-w-0 items-center gap-2 md:hidden">
              <button
                type="button"
                onClick={() => setMoreOpen(true)}
                className="rounded-md border border-(--line) p-1.5"
                aria-label="Open menu"
              >
                <Menu className="h-3.5 w-3.5" />
              </button>
              <div className="min-w-0">
                <p className="truncate font-serif text-[15px] leading-none">
                  Mapps
                </p>
                <p className="truncate text-[10px] text-(--muted)">RFD ERP</p>
              </div>
            </div>
            <p className="hidden text-[11px] text-(--muted) md:block">
              Grey → program → QC → stock → sale → delivery · Goods return
            </p>
            <div className="flex items-center gap-2">
              <span
                className={`hidden items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold sm:inline-flex ${
                  waLive ? "badge-wa" : "badge-muted"
                }`}
              >
                <MessageCircle className="h-3 w-3" />
                {waLive ? "Meta WhatsApp" : "WhatsApp stub"}
              </span>
              <p className="truncate text-right text-[11px] text-(--muted)">
                {user.email}
              </p>
            </div>
          </header>

          <main className="animate-fade-up flex-1 px-3 py-3 pb-18 sm:px-4 md:pb-4">
            {children}
          </main>
        </div>
      </div>

      <MobileBottomNav />
      <MobileMoreMenu open={moreOpen} onClose={() => setMoreOpen(false)} />
    </div>
  );
}

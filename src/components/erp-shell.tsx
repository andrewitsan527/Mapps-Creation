"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { logoutAction } from "@/server/actions/auth";
import type { UserRole } from "@/lib/roles";
import { MobileBottomNav, MobileMoreMenu, SideNav } from "@/components/erp-nav";

export function ErpShell({
  user,
  children,
}: {
  user: { name: string; email: string; role: UserRole };
  children: React.ReactNode;
}) {
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <div className="min-h-screen bg-(--surface) text-(--ink)">
      <div className="flex min-h-screen">
        <aside className="sticky top-0 hidden h-screen w-[168px] shrink-0 flex-col bg-(--sidebar) text-(--sidebar-ink) md:flex">
          <div className="border-b border-white/10 px-2.5 py-2">
            <p className="text-[9px] font-semibold tracking-[0.12em] text-(--sidebar-muted) uppercase">
              Mapps Creation
            </p>
            <p className="text-[13px] font-semibold leading-tight text-white">
              RFD ERP
            </p>
          </div>
          <SideNav />
          <div className="mt-auto border-t border-white/10 px-2.5 py-2">
            <p className="truncate text-[11px] font-medium text-white">{user.name}</p>
            <p className="truncate text-[10px] text-(--sidebar-muted)">{user.role}</p>
            <form action={logoutAction} className="mt-1">
              <button
                type="submit"
                className="text-[11px] text-(--sidebar-muted) underline-offset-2 hover:text-white hover:underline"
              >
                Sign out
              </button>
            </form>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-9 items-center justify-between gap-2 border-b border-(--line) bg-(--panel) px-2.5 sm:px-3">
            <div className="flex min-w-0 items-center gap-1.5 md:hidden">
              <button
                type="button"
                onClick={() => setMoreOpen(true)}
                className="rounded border border-(--line) p-1"
                aria-label="Open menu"
              >
                <Menu className="h-3.5 w-3.5" />
              </button>
              <p className="truncate text-[13px] font-semibold">Mapps</p>
            </div>
            <p className="hidden text-[11px] text-(--muted) md:block">
              Grey → program → QC → stock → sale bill → delivery · GR → QC → stock
            </p>
            <p className="truncate text-right text-[11px] text-(--muted)">
              {user.email}
            </p>
          </header>

          <main className="flex-1 px-2.5 py-2 pb-16 sm:px-3 md:pb-2.5">
            {children}
          </main>
        </div>
      </div>

      <MobileBottomNav />
      <MobileMoreMenu open={moreOpen} onClose={() => setMoreOpen(false)} />
    </div>
  );
}

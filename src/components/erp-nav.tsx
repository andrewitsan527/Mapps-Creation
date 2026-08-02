"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import { allNavLinks, navClusters, type NavLink } from "@/lib/flow";
import { cn } from "@/lib/utils";

export type { NavLink } from "@/lib/flow";

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Counts rendered as pills next to nav links, keyed by href. */
export type NavBadges = Record<string, number>;

export function SideNav({ badges = {} }: { badges?: NavBadges }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-1 flex-col gap-3 overflow-y-auto px-1.5 py-2.5">
      {navClusters.map((cluster) => (
        <div key={cluster.id}>
          <p className="mb-1 px-1.5 text-[9px] font-semibold tracking-[0.14em] text-(--sidebar-muted) uppercase">
            {cluster.title}
          </p>
          <ul className="space-y-px">
            {cluster.items.map((item) => {
              const active = isActive(pathname, item.href);
              const Icon = item.icon;
              const badge = badges[item.href];
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    prefetch
                    className={cn(
                      "group relative flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[12px] transition",
                      active
                        ? "bg-(--sidebar-active) font-semibold text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]"
                        : "text-(--sidebar-ink) hover:bg-(--sidebar-hover) hover:text-white",
                    )}
                  >
                    {active ? (
                      <span className="absolute top-1.5 bottom-1.5 -left-1.5 w-0.5 rounded-r bg-[#e8c547]" />
                    ) : null}
                    <Icon className="h-3.5 w-3.5 shrink-0 opacity-90" />
                    <span className="truncate">{item.label}</span>
                    {badge ? (
                      <span className="ml-auto rounded-full bg-white/10 px-1.5 text-[10px] font-semibold tabular-nums text-white">
                        {badge}
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

const mobileItems: NavLink[] = allNavLinks.filter((i) => i.mobile).slice(0, 5);

export function MobileBottomNav({ onMore }: { onMore: () => void }) {
  const pathname = usePathname();
  const items = mobileItems.slice(0, 4);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-(--line) bg-(--panel)/95 backdrop-blur md:hidden">
      <ul className="grid grid-cols-5 gap-0 px-1 pb-[env(safe-area-inset-bottom)]">
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-0.5 px-1 py-2 text-[10px] font-medium",
                  active ? "text-(--accent)" : "text-(--muted)",
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="truncate">{item.label.split(" ")[0]}</span>
              </Link>
            </li>
          );
        })}
        <li>
          <button
            type="button"
            onClick={onMore}
            className="flex w-full flex-col items-center gap-0.5 px-1 py-2 text-[10px] font-medium text-(--muted)"
          >
            <MoreHorizontal className="h-4 w-4" />
            <span>More</span>
          </button>
        </li>
      </ul>
    </nav>
  );
}

export function MobileMoreMenu({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 md:hidden">
      <button
        type="button"
        className="absolute inset-0 bg-black/45"
        aria-label="Close menu"
        onClick={onClose}
      />
      <div className="absolute inset-x-0 bottom-0 max-h-[80vh] overflow-y-auto rounded-t-xl bg-(--panel) p-3 shadow-(--shadow-pop)">
        <div className="mb-2 flex items-center justify-between">
          <p className="font-serif text-[15px] font-semibold">All modules</p>
          <button
            type="button"
            className="text-[12px] text-(--muted)"
            onClick={onClose}
          >
            Close
          </button>
        </div>
        <div className="space-y-2.5">
          {navClusters.map((cluster) => (
            <div key={cluster.id}>
              <p className="band-label mb-1">
                {cluster.title} · {cluster.caption}
              </p>
              <div className="grid grid-cols-2 gap-1">
                {cluster.items.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(pathname, item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onClose}
                      className={cn(
                        "flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-[12px]",
                        active
                          ? "border-(--accent) bg-(--accent-soft) font-semibold text-(--accent-strong)"
                          : "border-(--line) text-(--ink-soft)",
                      )}
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

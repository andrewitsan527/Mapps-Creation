"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Banknote,
  Boxes,
  Briefcase,
  Building2,
  Calculator,
  ClipboardCheck,
  CreditCard,
  Factory,
  LayoutDashboard,
  MessageSquare,
  Package,
  PackageOpen,
  Palette,
  BarChart3,
  RotateCcw,
  Scissors,
  ScrollText,
  Shirt,
  Truck,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  group?: "main" | "masters";
  mobile?: boolean;
};

export const navItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, group: "main", mobile: true },
  { href: "/stock", label: "Stock", icon: Boxes, group: "main", mobile: true },
  { href: "/grey", label: "Grey PO", icon: Package, group: "main", mobile: true },
  { href: "/programs", label: "Programs", icon: ScrollText, group: "main", mobile: true },
  { href: "/qc", label: "QC", icon: ClipboardCheck, group: "main", mobile: true },
  { href: "/sales", label: "Sales", icon: CreditCard, group: "main", mobile: true },
  { href: "/dispatch", label: "Delivery", icon: Truck, group: "main" },
  { href: "/payments", label: "Payments", icon: Banknote, group: "main" },
  { href: "/finance", label: "Finance", icon: Calculator, group: "main" },
  { href: "/returns", label: "Goods return", icon: RotateCcw, group: "main" },
  { href: "/messages", label: "WhatsApp", icon: MessageSquare, group: "main" },
  { href: "/reports", label: "Reports", icon: BarChart3, group: "main" },
  { href: "/masters/fabrics", label: "Fabrics", icon: Shirt, group: "masters" },
  { href: "/masters/colors", label: "Colors", icon: Palette, group: "masters", mobile: true },
  { href: "/masters/parties", label: "Parties", icon: Users, group: "masters" },
  { href: "/masters/mills", label: "Mills", icon: Building2, group: "masters" },
  { href: "/masters/weavers", label: "Weavers", icon: Scissors, group: "masters" },
  { href: "/masters/agents", label: "Agents", icon: Briefcase, group: "masters" },
  { href: "/masters/suppliers", label: "Suppliers", icon: PackageOpen, group: "masters" },
  { href: "/masters/finishes", label: "Finishes", icon: Factory, group: "masters" },
];

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SideNav() {
  const pathname = usePathname();
  const main = navItems.filter((i) => i.group === "main");
  const masters = navItems.filter((i) => i.group === "masters");

  return (
    <nav className="flex flex-1 flex-col gap-2.5 overflow-y-auto px-1.5 py-2">
      <NavSection title="Operations" items={main} pathname={pathname} />
      <NavSection title="Masters" items={masters} pathname={pathname} />
    </nav>
  );
}

function NavSection({
  title,
  items,
  pathname,
}: {
  title: string;
  items: NavItem[];
  pathname: string;
}) {
  return (
    <div>
      <p className="mb-0.5 px-1.5 text-[9px] font-semibold tracking-[0.12em] text-(--sidebar-muted) uppercase">
        {title}
      </p>
      <ul className="space-y-px">
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[12px] transition",
                  active
                    ? "bg-(--sidebar-active) font-semibold text-white shadow-sm"
                    : "text-(--sidebar-ink) hover:bg-(--sidebar-hover)",
                )}
              >
                <Icon className="h-3.5 w-3.5 shrink-0 opacity-90" />
                <span className="truncate">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function MobileBottomNav() {
  const pathname = usePathname();
  const items = navItems.filter((i) => i.mobile).slice(0, 5);

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
                <span className="truncate">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function MobileMoreMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 md:hidden">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Close menu"
        onClick={onClose}
      />
      <div className="absolute inset-x-0 bottom-0 max-h-[75vh] overflow-y-auto rounded-t-xl bg-(--panel) p-2.5 shadow-xl">
        <div className="mb-1.5 flex items-center justify-between px-0.5">
          <p className="text-[13px] font-semibold">All modules</p>
          <button type="button" className="text-[12px] text-(--muted)" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="grid grid-cols-2 gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-1.5 rounded border px-2 py-1.5 text-[12px]",
                  active
                    ? "border-(--accent) bg-(--accent-soft) text-(--accent-strong)"
                    : "border-(--line)",
                )}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

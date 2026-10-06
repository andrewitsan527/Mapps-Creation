import {
  Banknote,
  BarChart3,
  Boxes,
  Briefcase,
  Building2,
  Calculator,
  BadgeCheck,
  ClipboardCheck,
  ClipboardList,
  Hammer,
  MapPin,
  CreditCard,
  Factory,
  FileText,
  Inbox,
  ArrowDownToLine,
  LayoutDashboard,
  LayoutGrid,
  MessageSquare,
  Package,
  RotateCcw,
  Scissors,
  ScrollText,
  Shirt,
  Truck,
  Users,
  type LucideIcon,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Navigation clusters                                                 */
/* ------------------------------------------------------------------ */

export type NavLink = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Shown in the 5-slot mobile bar. */
  mobile?: boolean;
};

export type NavCluster = {
  id: string;
  title: string;
  /** Short caption shown in the mobile module sheet. */
  caption: string;
  items: NavLink[];
};

export const navClusters: NavCluster[] = [
  {
    id: "main-menu",
    title: "",
    caption: "Main menu",
    items: [{ href: "/menu", label: "Main Menu", icon: LayoutGrid }],
  },
  {
    id: "command",
    title: "Command",
    caption: "Daily control",
    items: [
      {
        href: "/dashboard",
        label: "Control tower",
        icon: LayoutDashboard,
        mobile: true,
      },
    ],
  },
  {
    id: "procure",
    title: "Procure",
    caption: "Grey in",
    items: [
      { href: "/purchase-orders", label: "Purchase order", icon: ClipboardList },
      { href: "/grey", label: "Grey purchase", icon: Package },
      { href: "/grey-purchase", label: "Grey bills", icon: FileText },
    ],
  },
  {
    id: "produce",
    title: "Produce",
    caption: "Mill & quality",
    items: [
      { href: "/programs", label: "Mill programs", icon: ScrollText, mobile: true },
      { href: "/inward", label: "Mill Inward", icon: Inbox, mobile: true },
      { href: "/mill-inward", label: "Inward desk", icon: ArrowDownToLine },
      { href: "/mill-program", label: "Mill Program", icon: Factory },
      { href: "/finished-work", label: "Finished Work", icon: Shirt },
      { href: "/quality-check", label: "QC desk", icon: BadgeCheck },
      { href: "/qc", label: "Quality check", icon: ClipboardCheck, mobile: true },
    ],
  },
  {
    id: "inventory",
    title: "Inventory",
    caption: "Stock & returns",
    items: [
      { href: "/live-stock", label: "Live Stock", icon: LayoutGrid },
      { href: "/stock", label: "Live stock", icon: Boxes, mobile: true },
      { href: "/returns", label: "Goods return", icon: RotateCcw },
    ],
  },
  {
    id: "sell",
    title: "Sell",
    caption: "Bills & delivery",
    items: [
      { href: "/sales", label: "Sales", icon: CreditCard, mobile: true },
      { href: "/dispatch", label: "Delivery", icon: Truck },
    ],
  },
  {
    id: "money",
    title: "Money",
    caption: "Dues & ledger",
    items: [
      { href: "/payments", label: "Payments & dues", icon: Banknote },
      { href: "/finance", label: "Finance tools", icon: Calculator },
    ],
  },
  {
    id: "insight",
    title: "Insight",
    caption: "Reports & comms",
    items: [
      { href: "/reports", label: "Reports", icon: BarChart3 },
      { href: "/messages", label: "WhatsApp log", icon: MessageSquare },
    ],
  },
  {
    id: "masters",
    title: "Masters",
    caption: "Setup data",
    items: [
      { href: "/masters/sales-agents", label: "Sales Agent", icon: Briefcase },
      { href: "/masters/sales", label: "Sales Master", icon: Users },
      { href: "/masters/knitters", label: "Knitters", icon: Scissors },
      { href: "/masters/process-mills", label: "Mills", icon: Building2 },
      { href: "/masters/transport", label: "Transport", icon: Truck },
      { href: "/masters/jobs", label: "Job Master", icon: Hammer },
      { href: "/masters/hastes", label: "Haste", icon: MapPin },
      { href: "/masters/items", label: "Item Master", icon: Shirt },
      {
        href: "/masters/purchase-agents",
        label: "Purchase Agent",
        icon: Briefcase,
      },
    ],
  },
];

export const allNavLinks: NavLink[] = navClusters.flatMap((c) => c.items);

const mainMenuCluster: NavCluster = {
  id: "main-menu",
  title: "Main menu",
  caption: "Shortcuts",
  items: [{ href: "/menu", label: "Main menu", icon: LayoutDashboard }],
};

export function clusterForPath(pathname: string): NavCluster | undefined {
  if (pathname === "/menu") return mainMenuCluster;
  return navClusters.find((cluster) =>
    cluster.items.some(
      (item) =>
        pathname === item.href || pathname.startsWith(`${item.href}/`),
    ),
  );
}

export function linkForPath(pathname: string): NavLink | undefined {
  if (pathname === "/menu") return mainMenuCluster.items[0];
  return allNavLinks
    .filter(
      (item) =>
        pathname === item.href || pathname.startsWith(`${item.href}/`),
    )
    .sort((a, b) => b.href.length - a.href.length)[0];
}

/* ------------------------------------------------------------------ */
/* The order-to-cash pipeline                                          */
/* ------------------------------------------------------------------ */

export type StageKey =
  | "grey"
  | "program"
  | "qc"
  | "stock"
  | "sale"
  | "delivery"
  | "payment";

export type Stage = {
  key: StageKey;
  label: string;
  href: string;
  icon: LucideIcon;
  /** What is waiting at this stage. */
  queueLabel: string;
  /** The action that moves work to the next stage. */
  action: string;
};

export const pipeline: Stage[] = [
  {
    key: "grey",
    label: "Grey",
    href: "/grey",
    icon: Package,
    queueLabel: "POs without a program",
    action: "Raise program",
  },
  {
    key: "program",
    label: "Program",
    href: "/programs",
    icon: ScrollText,
    queueLabel: "At mill, awaiting goods",
    action: "Log mill return",
  },
  {
    key: "qc",
    label: "QC",
    href: "/qc",
    icon: ClipboardCheck,
    queueLabel: "Lots awaiting inspection",
    action: "Submit QC",
  },
  {
    key: "stock",
    label: "Stock",
    href: "/stock",
    icon: Boxes,
    queueLabel: "Lots available to sell",
    action: "Reserve or bill",
  },
  {
    key: "sale",
    label: "Sale",
    href: "/sales",
    icon: CreditCard,
    queueLabel: "Provisional orders open",
    action: "Convert to sale",
  },
  {
    key: "delivery",
    label: "Delivery",
    href: "/dispatch",
    icon: Truck,
    queueLabel: "Bills awaiting dispatch",
    action: "Deliver & notify",
  },
  {
    key: "payment",
    label: "Payment",
    href: "/payments",
    icon: Banknote,
    queueLabel: "Dispatched bills unpaid",
    action: "Record receipt",
  },
];

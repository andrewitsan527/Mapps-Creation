import Link from "next/link";
import {
  Banknote,
  BarChart3,
  ChevronRight,
  ClipboardCheck,
  CreditCard,
  LayoutGrid,
  Package,
} from "lucide-react";
import { PageHeader } from "@/components/ui";

const shortcuts = [
  {
    href: "/grey",
    label: "Grey Purchase",
    hint: "Raise grey POs and supplier bills",
    icon: Package,
    surface: "menu-tile-ivory",
  },
  {
    href: "/inward",
    label: "Mill Inward",
    hint: "Log mill return and inspect lots",
    icon: ClipboardCheck,
    surface: "menu-tile-sage",
  },
  {
    href: "/sales",
    label: "Sale Bill — QC, Goods Return",
    hint: "Issue sale or provisional bills",
    icon: CreditCard,
    surface: "menu-tile-stone",
  },
  {
    href: "/payments",
    label: "Payment, Receivables / Outstanding",
    hint: "Receipts, dues and outstanding",
    icon: Banknote,
    surface: "menu-tile-sand",
  },
  {
    href: "/reports",
    label: "Reports",
    hint: "Quality, stock and sales snapshot",
    icon: BarChart3,
    surface: "menu-tile-ivory",
  },
] as const;

function ShortcutCard({
  item,
}: {
  item: (typeof shortcuts)[number];
}) {
  const Icon = item.icon;
  return (
    <Link href={item.href} className={`menu-tile ${item.surface}`}>
      <span className="menu-icon">
        <Icon className="h-[18px] w-[18px]" />
      </span>
      <p className="menu-tile-title font-serif">{item.label}</p>
      <p className="menu-tile-hint">{item.hint}</p>
      <span className="menu-tile-go" aria-hidden>
        <ChevronRight className="h-4 w-4" />
      </span>
    </Link>
  );
}

export default function MainMenuPage() {
  return (
    <div className="menu-page">
      <div className="menu-page-stage">
      <div className="menu-chrome mb-5">
      <PageHeader title="Main menu" icon={LayoutGrid} />
      </div>

      <div className="menu-desk">
        <div className="menu-row menu-row-3">
          {shortcuts.slice(0, 3).map((item) => (
            <ShortcutCard key={item.href} item={item} />
          ))}
        </div>
        <div className="menu-row menu-row-2">
          {shortcuts.slice(3).map((item) => (
            <ShortcutCard key={item.href} item={item} />
          ))}
        </div>
      </div>
      </div>
    </div>
  );
}

import Link from "next/link";
import {
  ArrowDownToLine,
  Banknote,
  BarChart3,
  ChevronRight,
  CreditCard,
  FileText,
} from "lucide-react";

const lead = [
  {
    href: "/grey-purchase",
    label: "Grey Purchase",
    hint: "Grey purchase bills",
    icon: FileText,
    surface: "menu-tile-sage",
  },
  {
    href: "/mill-inward",
    label: "Mill Inward",
    hint: "Mill inward and returns",
    icon: ArrowDownToLine,
    surface: "menu-tile-stone",
  },
] as const;

const shortcuts = [
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
  item: {
    href: string;
    label: string;
    hint: string;
    icon: typeof CreditCard;
    surface: string;
  };
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
      <div className="menu-desk">
        <div className="menu-row menu-row-pair">
          {lead.map((item) => (
            <ShortcutCard key={item.href} item={item} />
          ))}
        </div>
        <div className="menu-row menu-row-3">
          {shortcuts.map((item) => (
            <ShortcutCard key={item.href} item={item} />
          ))}
        </div>
      </div>
      </div>
    </div>
  );
}

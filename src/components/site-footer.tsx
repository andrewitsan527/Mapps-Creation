import { cn } from "@/lib/utils";
import { COMPANY } from "@/lib/company";

/** Compact credit line for shell + login. */
export function SiteFooter({
  className,
  tone = "light",
}: {
  className?: string;
  /** `dark` for login weave; `light` for ERP chrome. */
  tone?: "light" | "dark";
}) {
  const year = new Date().getFullYear();

  return (
    <footer
      className={cn(
        "no-print border-t px-3 py-2 text-center sm:px-4",
        tone === "dark"
          ? "border-white/10 text-white/45"
          : "border-(--line) bg-(--panel)/80 text-(--faint) backdrop-blur-sm",
        className,
      )}
    >
      <p className="text-[10px] leading-relaxed tracking-wide sm:text-[10.5px]">
        © {year} {COMPANY.shortName}
        <span className="mx-1.5 opacity-40">·</span>
        Developed by{" "}
        <span
          className={
            tone === "dark" ? "font-semibold text-white/70" : "font-semibold text-(--ink-soft)"
          }
        >
          {COMPANY.developedBy}
        </span>
        <span className="mx-1.5 opacity-40">·</span>
        Powered by{" "}
        <span
          className={
            tone === "dark" ? "font-semibold text-[#e8c547]/90" : "font-semibold text-(--accent)"
          }
        >
          {COMPANY.poweredBy}
        </span>
      </p>
    </footer>
  );
}

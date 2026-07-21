import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export function PageHeader({
  title,
  description,
  actions,
  icon: Icon,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  icon?: LucideIcon;
}) {
  return (
    <div className="mb-2.5 flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          {Icon ? (
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-(--line) bg-(--panel) text-(--accent)">
              <Icon className="h-3.5 w-3.5" />
            </span>
          ) : null}
          <h1 className="text-[16px] font-semibold tracking-tight text-(--ink)">
            {title}
          </h1>
        </div>
        {description ? (
          <p className="mt-0.5 max-w-3xl text-[11px] leading-snug text-(--muted)">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap gap-1.5">{actions}</div>
      ) : null}
    </div>
  );
}

export function Panel({
  children,
  className,
  title,
  compact,
  icon: Icon,
  action,
}: {
  children: React.ReactNode;
  className?: string;
  title?: string;
  compact?: boolean;
  icon?: LucideIcon;
  action?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "panel-elevated rounded-lg border border-(--line) bg-(--panel)",
        className,
      )}
    >
      {title ? (
        <div className="flex items-center justify-between gap-2 border-b border-(--line) px-2.5 py-1.5">
          <h2 className="flex items-center gap-1.5 text-[12px] font-semibold tracking-tight text-(--ink)">
            {Icon ? <Icon className="h-3.5 w-3.5 text-(--accent)" /> : null}
            {title}
          </h2>
          {action}
        </div>
      ) : null}
      <div className={cn(compact ? "p-2" : "p-2.5")}>{children}</div>
    </div>
  );
}

export function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block space-y-0.5 text-[12px]", className)}>
      <span className="font-medium text-(--muted)">{label}</span>
      {children}
    </label>
  );
}

export const inputClass =
  "w-full rounded-md border border-(--line) bg-white px-2.5 py-1.5 text-[12px] outline-none transition placeholder:text-(--muted)/60 focus:border-(--accent) focus:ring-2 focus:ring-(--accent-soft)";

export const buttonClass =
  "inline-flex items-center justify-center gap-1.5 rounded-md border border-transparent bg-(--accent) px-2.5 py-1.5 text-[12px] font-semibold text-white shadow-sm transition hover:bg-(--accent-strong) disabled:opacity-50";

export const buttonGhostClass =
  "inline-flex items-center justify-center gap-1.5 rounded-md border border-(--line) bg-white px-2.5 py-1.5 text-[12px] font-medium text-(--ink) transition hover:border-(--line-strong) hover:bg-(--surface) disabled:opacity-50";

export const buttonWaClass =
  "inline-flex items-center justify-center gap-1.5 rounded-md border border-transparent bg-(--wa) px-2.5 py-1.5 text-[12px] font-semibold text-white shadow-sm transition hover:brightness-110 disabled:opacity-50";

export function EmptyState({
  text,
  icon: Icon,
}: {
  text: string;
  icon?: LucideIcon;
}) {
  return (
    <div className="rounded-md border border-dashed border-(--line) bg-[#f8fafb] px-3 py-4 text-center">
      {Icon ? (
        <Icon className="mx-auto mb-1.5 h-4 w-4 text-(--muted)" />
      ) : null}
      <p className="text-[11px] text-(--muted)">{text}</p>
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon?: LucideIcon;
}) {
  return (
    <div className="panel-elevated rounded-lg border border-(--line) bg-(--panel) px-2.5 py-2">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-semibold tracking-wide text-(--muted) uppercase">
          {label}
        </p>
        {Icon ? <Icon className="h-3.5 w-3.5 text-(--accent)" /> : null}
      </div>
      <p className="mt-1 text-[16px] font-semibold tracking-tight tabular-nums leading-none">
        {value}
      </p>
      {hint ? (
        <p className="mt-1 text-[10px] text-(--muted)">{hint}</p>
      ) : null}
    </div>
  );
}

import Link from "next/link";
import { cn } from "@/lib/utils";
import { ChevronRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type Tone = "neutral" | "accent" | "warn" | "danger" | "info" | "wa";

const toneText: Record<Tone, string> = {
  neutral: "text-(--muted)",
  accent: "text-(--accent)",
  warn: "text-(--warn)",
  danger: "text-(--danger)",
  info: "text-(--info)",
  wa: "text-(--wa)",
};

const toneChip: Record<Tone, string> = {
  neutral: "badge badge-muted",
  accent: "badge badge-ok",
  warn: "badge badge-warn",
  danger: "badge badge-danger",
  info: "badge badge-info",
  wa: "badge badge-wa",
};

/* ------------------------------------------------------------------ */
/* Page chrome                                                         */
/* ------------------------------------------------------------------ */

export function PageHeader({
  title,
  description,
  actions,
  icon: Icon,
  eyebrow,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  icon?: LucideIcon;
  eyebrow?: string;
}) {
  return (
    <div className="mb-3 flex flex-col gap-1.5 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow ? <p className="band-label mb-1">{eyebrow}</p> : null}
        <div className="flex items-center gap-2">
          {Icon ? (
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-(--line) bg-linear-to-b from-white to-(--panel-sunken) text-(--accent) shadow-(--shadow-sm)">
              <Icon className="h-4 w-4" />
            </span>
          ) : null}
          <h1 className="truncate font-serif text-[19px] leading-tight font-semibold tracking-tight text-(--ink)">
            {title}
          </h1>
        </div>
        {description ? (
          <p className="mt-1 max-w-3xl text-[11.5px] leading-snug text-(--muted)">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          {actions}
        </div>
      ) : null}
    </div>
  );
}

export function Breadcrumbs({
  items,
}: {
  items: { label: string; href?: string }[];
}) {
  return (
    <nav className="mb-2 flex flex-wrap items-center gap-1 text-[11px] text-(--muted)">
      {items.map((item, i) => (
        <span key={`${item.label}-${i}`} className="flex items-center gap-1">
          {i > 0 ? (
            <ChevronRight className="h-3 w-3 text-(--faint)" />
          ) : null}
          {item.href ? (
            <Link
              href={item.href}
              className="rounded px-0.5 transition hover:text-(--accent) hover:underline"
            >
              {item.label}
            </Link>
          ) : (
            <span className="font-medium text-(--ink-soft)">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

/* ------------------------------------------------------------------ */
/* Clustering: Section groups a set of related panels into one band    */
/* ------------------------------------------------------------------ */

export function Section({
  title,
  step,
  description,
  icon: Icon,
  actions,
  children,
  className,
  tone = "neutral",
}: {
  title: string;
  step?: string | number;
  description?: string;
  icon?: LucideIcon;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  tone?: Tone;
}) {
  return (
    <section className={cn("space-y-2", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-(--line) pb-1.5">
        <div className="flex min-w-0 items-center gap-2">
          {step !== undefined ? (
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-(--ink) text-[10px] font-bold text-white">
              {step}
            </span>
          ) : null}
          {Icon ? (
            <Icon className={cn("h-3.5 w-3.5", toneText[tone])} />
          ) : null}
          <h2 className="text-[12.5px] font-semibold tracking-tight text-(--ink)">
            {title}
          </h2>
          {description ? (
            <span className="hidden truncate text-[11px] text-(--muted) sm:inline">
              · {description}
            </span>
          ) : null}
        </div>
        {actions ? (
          <div className="flex flex-wrap items-center gap-1.5">{actions}</div>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export function Panel({
  children,
  className,
  title,
  compact,
  flush,
  icon: Icon,
  action,
  subtitle,
  tone = "neutral",
}: {
  children: React.ReactNode;
  className?: string;
  title?: string;
  compact?: boolean;
  /** Remove body padding — use for full-bleed tables. */
  flush?: boolean;
  icon?: LucideIcon;
  action?: React.ReactNode;
  subtitle?: string;
  tone?: Tone;
}) {
  return (
    <div
      className={cn(
        "panel-elevated overflow-hidden rounded-lg border border-(--line) bg-(--panel)",
        className,
      )}
    >
      {title ? (
        <div className="flex items-center justify-between gap-2 border-b border-(--line) bg-(--panel-alt) px-2.5 py-1.5">
          <div className="flex min-w-0 items-center gap-1.5">
            {Icon ? (
              <Icon className={cn("h-3.5 w-3.5 shrink-0", toneText[tone])} />
            ) : null}
            <h3 className="truncate text-[12px] font-semibold tracking-tight text-(--ink)">
              {title}
            </h3>
            {subtitle ? (
              <span className="truncate text-[11px] text-(--muted)">
                · {subtitle}
              </span>
            ) : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      ) : null}
      <div className={cn(flush ? "" : compact ? "p-2" : "p-2.5")}>
        {children}
      </div>
    </div>
  );
}

/** Scroll container that keeps `.erp-table` sticky headers working. */
export function TableWrap({
  children,
  maxHeight,
  className,
}: {
  children: React.ReactNode;
  maxHeight?: number;
  className?: string;
}) {
  return (
    <div
      className={cn("overflow-auto", className)}
      style={maxHeight ? { maxHeight } : undefined}
    >
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Form primitives                                                     */
/* ------------------------------------------------------------------ */

export function Field({
  label,
  children,
  className,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
  hint?: string;
}) {
  return (
    <label className={cn("block space-y-0.5 text-[12px]", className)}>
      <span className="font-medium text-(--muted)">{label}</span>
      {children}
      {hint ? (
        <span className="block text-[10px] text-(--faint)">{hint}</span>
      ) : null}
    </label>
  );
}

/** Groups form fields under a small caption inside a form panel. */
export function FieldGroup({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <p className="band-label">{label}</p>
      {children}
    </div>
  );
}

export const inputClass =
  "w-full rounded-md border border-(--line) bg-white px-2.5 py-1.5 text-[12px] outline-none transition placeholder:text-(--faint) hover:border-(--line-strong) focus:border-(--accent) focus:ring-2 focus:ring-(--accent-soft)";

export const buttonClass =
  "inline-flex items-center justify-center gap-1.5 rounded-md border border-transparent bg-(--accent) px-2.5 py-1.5 text-[12px] font-semibold text-white shadow-(--shadow-sm) transition hover:bg-(--accent-strong) active:translate-y-px disabled:opacity-50";

export const buttonGhostClass =
  "inline-flex items-center justify-center gap-1.5 rounded-md border border-(--line) bg-white px-2.5 py-1.5 text-[12px] font-medium text-(--ink) transition hover:border-(--line-strong) hover:bg-(--panel-sunken) active:translate-y-px disabled:opacity-50";

export const buttonWaClass =
  "inline-flex items-center justify-center gap-1.5 rounded-md border border-transparent bg-(--wa) px-2.5 py-1.5 text-[12px] font-semibold text-white shadow-(--shadow-sm) transition hover:brightness-110 active:translate-y-px disabled:opacity-50";

export const buttonTinyClass =
  "inline-flex items-center justify-center gap-1 rounded border border-(--line) bg-white px-1.5 py-0.5 text-[11px] font-medium text-(--ink-soft) transition hover:border-(--accent) hover:text-(--accent)";

/* ------------------------------------------------------------------ */
/* Data display                                                        */
/* ------------------------------------------------------------------ */

export function EmptyState({
  text,
  icon: Icon,
  action,
}: {
  text: string;
  icon?: LucideIcon;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-md border border-dashed border-(--line) bg-(--panel-sunken) px-3 py-5 text-center">
      {Icon ? <Icon className="mx-auto mb-1.5 h-4 w-4 text-(--faint)" /> : null}
      <p className="text-[11px] text-(--muted)">{text}</p>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "neutral",
  href,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon?: LucideIcon;
  tone?: Tone;
  href?: string;
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-semibold tracking-wide text-(--muted) uppercase">
          {label}
        </p>
        {Icon ? (
          <Icon className={cn("h-3.5 w-3.5 shrink-0", toneText[tone])} />
        ) : null}
      </div>
      <p
        className={cn(
          "mt-1 text-[17px] leading-none font-semibold tracking-tight tabular-nums",
          tone === "danger" && "text-(--danger)",
          tone === "warn" && "text-(--warn)",
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-1 text-[10px] text-(--muted)">{hint}</p> : null}
    </>
  );

  const base =
    "panel-elevated block rounded-lg border border-(--line) bg-(--panel) px-2.5 py-2";

  if (href) {
    return (
      <Link
        href={href}
        className={cn(
          base,
          "transition hover:border-(--accent) hover:shadow-(--shadow-pop)",
        )}
      >
        {body}
      </Link>
    );
  }
  return <div className={base}>{body}</div>;
}

/** Very compact KPI for dense strips — smaller than StatCard. */
export function Metric({
  label,
  value,
  tone = "neutral",
  hint,
}: {
  label: string;
  value: string | number;
  tone?: Tone;
  hint?: string;
}) {
  return (
    <div className="min-w-0 px-2.5 py-1.5">
      <p className="truncate text-[10px] font-semibold tracking-wide text-(--muted) uppercase">
        {label}
      </p>
      <p
        className={cn(
          "text-[14px] leading-tight font-semibold tabular-nums",
          toneText[tone] === "text-(--muted)" ? "text-(--ink)" : toneText[tone],
        )}
      >
        {value}
      </p>
      {hint ? (
        <p className="truncate text-[10px] text-(--faint)">{hint}</p>
      ) : null}
    </div>
  );
}

/** Horizontal strip of Metrics inside one bordered card. */
export function MetricStrip({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "panel-elevated grid divide-x divide-(--line-soft) overflow-hidden rounded-lg border border-(--line) bg-(--panel)",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Label/value pair list — replaces the repeated 4-up summary panels. */
export function KeyValue({
  items,
  columns = 1,
}: {
  items: { label: string; value: React.ReactNode }[];
  columns?: 1 | 2;
}) {
  return (
    <dl
      className={cn(
        "grid gap-x-3 gap-y-1",
        columns === 2 ? "grid-cols-2" : "grid-cols-1",
      )}
    >
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <dt className="text-[10px] font-semibold tracking-wide text-(--muted) uppercase">
            {item.label}
          </dt>
          <dd className="truncate text-[12px] font-medium text-(--ink)">
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function Chip({
  children,
  tone = "neutral",
  icon: Icon,
}: {
  children: React.ReactNode;
  tone?: Tone;
  icon?: LucideIcon;
}) {
  return (
    <span className={toneChip[tone]}>
      {Icon ? <Icon className="h-2.5 w-2.5" /> : null}
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Workflow handoff                                                    */
/* ------------------------------------------------------------------ */

/** "What happens next" card that links a module to the next stage. */
export function NextStep({
  steps,
}: {
  steps: { label: string; href: string; hint?: string; count?: number }[];
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {steps.map((step) => (
        <Link
          key={step.href + step.label}
          href={step.href}
          className="group panel-elevated flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-(--line) bg-(--panel) px-2.5 py-1.5 transition hover:border-(--accent) hover:bg-(--accent-soft)"
        >
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[12px] font-semibold text-(--ink)">
              {step.label}
            </span>
            {step.hint ? (
              <span className="block truncate text-[10.5px] text-(--muted)">
                {step.hint}
              </span>
            ) : null}
          </span>
          {step.count !== undefined ? (
            <span className="rounded-full bg-(--ink) px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-white">
              {step.count}
            </span>
          ) : null}
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-(--faint) transition group-hover:translate-x-0.5 group-hover:text-(--accent)" />
        </Link>
      ))}
    </div>
  );
}

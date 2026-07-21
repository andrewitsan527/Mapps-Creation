import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-2.5 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-[15px] font-semibold tracking-tight text-(--ink)">
          {title}
        </h1>
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
}: {
  children: React.ReactNode;
  className?: string;
  title?: string;
  /** Less padding — use for nested / side forms */
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-md border border-(--line) bg-(--panel)",
        className,
      )}
    >
      {title ? (
        <div className="border-b border-(--line) px-2.5 py-1.5">
          <h2 className="text-[12px] font-semibold tracking-tight text-(--ink)">
            {title}
          </h2>
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
  "w-full rounded border border-(--line) bg-white px-2 py-1 text-[12px] outline-none transition focus:border-(--accent) focus:ring-1 focus:ring-(--accent-soft)";

export const buttonClass =
  "inline-flex items-center justify-center rounded border border-transparent bg-(--accent) px-2.5 py-1 text-[12px] font-semibold text-white transition hover:bg-(--accent-strong) disabled:opacity-50";

export const buttonGhostClass =
  "inline-flex items-center justify-center rounded border border-(--line) bg-white px-2.5 py-1 text-[12px] font-medium text-(--ink) transition hover:bg-(--surface) disabled:opacity-50";

export function EmptyState({ text }: { text: string }) {
  return (
    <p className="rounded border border-dashed border-(--line) bg-[#fafbfc] px-2 py-2.5 text-center text-[11px] text-(--muted)">
      {text}
    </p>
  );
}

export function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="rounded-md border border-(--line) bg-(--panel) px-2.5 py-1.5">
      <p className="text-[10px] font-semibold tracking-wide text-(--muted) uppercase">
        {label}
      </p>
      <p className="mt-0.5 text-[15px] font-semibold tracking-tight tabular-nums leading-none">
        {value}
      </p>
      {hint ? (
        <p className="mt-0.5 text-[10px] text-(--muted)">{hint}</p>
      ) : null}
    </div>
  );
}

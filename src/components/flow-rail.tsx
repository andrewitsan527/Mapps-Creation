"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { pipeline, type StageKey } from "@/lib/flow";
import { cn } from "@/lib/utils";

export type FlowCounts = Partial<
  Record<StageKey, { queue: number; alert: number }>
>;

/**
 * Horizontal order-to-cash rail. Shows where work is sitting and lets the
 * user jump straight to the stage that needs attention.
 */
export function FlowRail({
  counts,
  className,
}: {
  counts: FlowCounts;
  className?: string;
}) {
  const pathname = usePathname();
  const activeIndex = pipeline.findIndex(
    (stage) =>
      pathname === stage.href || pathname.startsWith(`${stage.href}/`),
  );

  return (
    <div
      className={cn(
        "panel-elevated overflow-hidden rounded-xl border border-(--line) bg-(--panel)",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b border-(--line) bg-linear-to-r from-(--panel-alt) to-white px-3 py-1.5">
        <p className="band-label">Order-to-cash flow</p>
        <p className="hidden text-[10.5px] text-(--muted) sm:block">
          Jump to the stage that needs you
        </p>
      </div>
      <ol className="-mx-0 flex snap-x snap-mandatory overflow-x-auto scroll-smooth px-0 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:snap-none">
        {pipeline.map((stage, index) => {
          const data = counts[stage.key];
          const queue = data?.queue ?? 0;
          const alert = data?.alert ?? 0;
          const isActive = index === activeIndex;
          const isDone = activeIndex >= 0 && index < activeIndex;
          const Icon = stage.icon;

          return (
            <li
              key={stage.key}
              className="min-w-[38%] shrink-0 snap-start sm:min-w-28 sm:flex-1 md:min-w-0"
            >
              <Link
                href={stage.href}
                prefetch
                title={`${stage.queueLabel} → ${stage.action}`}
                className={cn(
                  "group relative flex h-full flex-col gap-0.5 border-r border-(--line-soft) px-2.5 py-2 transition last:border-r-0",
                  isActive
                    ? "bg-(--accent-soft)"
                    : "hover:bg-(--panel-sunken)",
                )}
              >
                {isActive ? (
                  <span className="absolute inset-x-0 top-0 h-0.5 bg-(--accent)" />
                ) : null}
                <span className="flex items-center gap-1">
                  <Icon
                    className={cn(
                      "h-3.5 w-3.5 shrink-0 transition",
                      isActive
                        ? "text-(--accent)"
                        : isDone
                          ? "text-(--faint)"
                          : "text-(--muted) group-hover:text-(--ink-soft)",
                    )}
                  />
                  <span
                    className={cn(
                      "truncate text-[10.5px] font-semibold tracking-wide uppercase",
                      isActive ? "text-(--accent-strong)" : "text-(--muted)",
                    )}
                  >
                    {stage.label}
                  </span>
                </span>
                <span className="flex items-baseline gap-1">
                  <span className="text-[17px] leading-none font-semibold tabular-nums text-(--ink)">
                    {queue}
                  </span>
                  {alert > 0 ? (
                    <span className="badge badge-danger">{alert}</span>
                  ) : null}
                </span>
                <span className="truncate text-[10px] text-(--faint)">
                  {stage.queueLabel}
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

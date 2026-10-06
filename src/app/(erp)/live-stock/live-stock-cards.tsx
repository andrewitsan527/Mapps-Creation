"use client";

import { useState } from "react";
import { Boxes } from "lucide-react";
import { EmptyState, inputClass } from "@/components/ui";
import type { LiveStockColour } from "@/server/actions/live-stock";

function rollLabel(count: number) {
  return `${count} ${count === 1 ? "Roll" : "Rolls"}`;
}

export function LiveStockCards({ colours }: { colours: LiveStockColour[] }) {
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const visible = needle
    ? colours.filter((row) => row.colour.toLowerCase().includes(needle))
    : colours;

  return (
    <>
      <input
        className={`${inputClass} max-w-xs`}
        placeholder="Search colour..."
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        autoComplete="off"
      />
      {visible.length === 0 ? (
        <EmptyState icon={Boxes} text="No matching colour found" />
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {visible.map((row) => (
            <div
              key={row.colour.toLowerCase()}
              className="rounded-lg border border-(--line) bg-(--panel) px-3 py-3"
            >
              <p className="text-[15px] font-semibold text-(--ink)">{row.colour}</p>
              <p className="mt-1 text-[13px] tabular-nums text-(--muted)">
                {rollLabel(row.rolls)}
              </p>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

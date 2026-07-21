"use client";

import { useState } from "react";
import { inputClass } from "@/components/ui";

function normalizeHex(value: string) {
  const v = value.trim();
  if (!v) return "#808080";
  if (/^#[0-9a-fA-F]{6}$/.test(v)) return v;
  if (/^[0-9a-fA-F]{6}$/.test(v)) return `#${v}`;
  return "#808080";
}

export function ColorHexField({
  name = "hex",
  defaultValue = "#808080",
}: {
  name?: string;
  defaultValue?: string;
}) {
  const [hex, setHex] = useState(normalizeHex(defaultValue));

  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={normalizeHex(hex)}
        onChange={(e) => setHex(e.target.value)}
        className="h-9 w-12 cursor-pointer rounded-md border border-(--line) bg-white p-0.5"
        title="Pick shade color"
        aria-label="Pick shade color"
      />
      <input
        className={inputClass}
        name={name}
        value={hex}
        onChange={(e) => setHex(e.target.value)}
        placeholder="#4a0e0e"
        spellCheck={false}
      />
    </div>
  );
}

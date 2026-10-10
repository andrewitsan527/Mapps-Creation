"use client";

import { inputClass } from "@/components/ui";

/** GSTIN input — forces CAPITAL letters as you type. */
export function GstinInput({
  name = "gstin",
  defaultValue = "",
}: {
  name?: string;
  defaultValue?: string;
}) {
  return (
    <input
      className={inputClass + " uppercase"}
      name={name}
      defaultValue={defaultValue}
      autoCapitalize="characters"
      autoCorrect="off"
      spellCheck={false}
      placeholder="24AAAAA0000A1Z5"
      onInput={(e) => {
        const el = e.currentTarget;
        const start = el.selectionStart;
        const end = el.selectionEnd;
        el.value = el.value.toUpperCase();
        if (start != null && end != null) el.setSelectionRange(start, end);
      }}
    />
  );
}

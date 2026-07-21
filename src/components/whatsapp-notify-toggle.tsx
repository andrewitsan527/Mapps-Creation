"use client";

import { MessageCircle } from "lucide-react";

/** Checkbox to optionally send WhatsApp on submit. */
export function WhatsAppNotifyToggle({
  name = "notifyWhatsapp",
  label = "Send WhatsApp",
  defaultChecked = true,
  hint,
}: {
  name?: string;
  label?: string;
  defaultChecked?: boolean;
  hint?: string;
}) {
  return (
    <label className="flex items-start gap-2 rounded-md border border-(--line) bg-(--wa-soft)/40 px-2 py-1.5 text-[11px]">
      <input
        type="checkbox"
        name={name}
        value="true"
        defaultChecked={defaultChecked}
        className="mt-0.5"
      />
      <span>
        <span className="inline-flex items-center gap-1 font-semibold text-(--wa)">
          <MessageCircle className="h-3 w-3" />
          {label}
        </span>
        {hint ? (
          <span className="mt-0.5 block text-(--muted)">{hint}</span>
        ) : null}
      </span>
    </label>
  );
}

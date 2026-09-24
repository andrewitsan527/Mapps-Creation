"use client";

import { completeMillReturn } from "@/server/actions/programs";
import { buttonTinyClass } from "@/components/ui";
import { formatQty } from "@/lib/utils";

export function MillReturnCompleteForm({
  programId,
  programNo,
  planned,
  received,
  remaining,
  unit,
}: {
  programId: string;
  programNo: string;
  planned: number;
  received: number;
  remaining: number;
  unit: string;
}) {
  return (
    <form
      action={completeMillReturn}
      onSubmit={(event) => {
        const ok = window.confirm(
          `${programNo}\n\n` +
            `Planned: ${formatQty(planned)} ${unit}\n` +
            `Received: ${formatQty(received)} ${unit}\n` +
            `Remaining: ${formatQty(remaining)} ${unit}\n\n` +
            `Confirm Mill Return Completed?\n` +
            `No further mill inward will be expected. Remaining is recorded as shortage/difference. No stock is created.`,
        );
        if (!ok) event.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={programId} />
      <button className={buttonTinyClass} type="submit">
        Mill Return Completed
      </button>
    </form>
  );
}

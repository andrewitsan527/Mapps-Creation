"use client";

import { Download, Printer } from "lucide-react";

export function PublicCardActions() {
  return (
    <div className="no-print mx-auto mt-4 flex max-w-[820px] flex-wrap items-center justify-center gap-2">
      <button
        type="button"
        onClick={() => window.print()}
        className="inline-flex items-center gap-1.5 rounded-md bg-[#1a1208] px-3.5 py-2 text-[12.5px] font-semibold text-[#e8c547]"
      >
        <Printer className="h-3.5 w-3.5" />
        Print
      </button>
      <button
        type="button"
        onClick={() => window.print()}
        className="inline-flex items-center gap-1.5 rounded-md border border-[#1a1208]/20 bg-white px-3.5 py-2 text-[12.5px] font-semibold text-[#1a1208]"
        title="In the print dialog, choose Save as PDF"
      >
        <Download className="h-3.5 w-3.5" />
        Save as PDF
      </button>
    </div>
  );
}

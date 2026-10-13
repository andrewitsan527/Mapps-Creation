"use client";

import { useRef } from "react";
import { Loader2 } from "lucide-react";
import { buttonGhostClass } from "@/components/ui";

export function GreyChallanUploadButton({
  busy,
  disabled,
  onFile,
}: {
  busy: boolean;
  disabled?: boolean;
  onFile: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="mb-2">
      <input
        ref={inputRef}
        className="hidden"
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
        disabled={disabled || busy}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) onFile(file);
        }}
      />
      <button
        type="button"
        className={`${buttonGhostClass} min-w-[8.5rem]`}
        disabled={disabled || busy}
        aria-busy={busy}
        onClick={() => inputRef.current?.click()}
      >
        {busy ? (
          <>
            <Loader2 className="gb-spin h-3.5 w-3.5" aria-hidden />
            Reading&hellip;
          </>
        ) : (
          "Upload Challan"
        )}
      </button>
    </div>
  );
}

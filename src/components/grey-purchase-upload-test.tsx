"use client";

import { useRef } from "react";
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
        className={buttonGhostClass}
        disabled={disabled || busy}
        onClick={() => inputRef.current?.click()}
      >
        {busy ? "INTELIXA" : "Upload Challan"}
      </button>
    </div>
  );
}

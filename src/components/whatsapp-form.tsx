"use client";

import { useTransition } from "react";

export type WhatsAppActionResult = {
  shareUrl?: string;
  /** When set, also open the generated PDF so it can be saved / attached. */
  pdfUrl?: string;
  error?: string;
} | void;

/**
 * Runs a server action, then opens WhatsApp (wa.me) when a shareUrl is returned.
 * If a pdfUrl is returned, opens that too (click-to-chat cannot attach files).
 */
export function WhatsAppForm({
  action,
  className,
  children,
}: {
  action: (formData: FormData) => Promise<WhatsAppActionResult>;
  className?: string;
  children: React.ReactNode;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <form
      className={className}
      action={(formData) => {
        startTransition(async () => {
          try {
            const result = await action(formData);
            if (result && typeof result === "object") {
              if (result.error) {
                window.alert(result.error);
                return;
              }
              if (result.pdfUrl) {
                window.open(result.pdfUrl, "_blank", "noopener,noreferrer");
              }
              if (result.shareUrl) {
                window.open(result.shareUrl, "_blank", "noopener,noreferrer");
              }
            }
          } catch (err) {
            window.alert(
              err instanceof Error ? err.message : "Something went wrong",
            );
          }
        });
      }}
    >
      <fieldset disabled={pending} className="min-w-0 border-0 p-0 contents">
        {children}
      </fieldset>
    </form>
  );
}

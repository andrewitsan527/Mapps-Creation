"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { buttonTinyClass } from "@/components/ui";

function focusableIn(root: HTMLElement) {
  const seen = new Set<HTMLElement>();
  const items = [
    ...root.querySelectorAll<HTMLElement>(
      "a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [data-po-tab]",
    ),
  ].filter((el) => {
    if (el.tabIndex === -1 || seen.has(el)) return false;
    seen.add(el);
    return true;
  });
  items.sort((a, b) => {
    const ar = Number(a.dataset.poTab || 0);
    const br = Number(b.dataset.poTab || 0);
    if (ar && br && ar !== br) return ar - br;
    if (ar && !br) return -1;
    if (!ar && br) return 1;
    return 0;
  });
  return items;
}

export function ErpModal({
  title,
  onClose,
  children,
  compact,
  flushBody,
  wide,
  roomy,
  form,
  trapFocus,
  closeTabIndex,
  cornerClose,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  compact?: boolean;
  flushBody?: boolean;
  wide?: boolean;
  form?: boolean;
  trapFocus?: boolean;
  closeTabIndex?: number;
  cornerClose?: boolean;
}) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!trapFocus) return;
    const root = rootRef.current;
    if (!root) return;

    focusableIn(root)[0]?.focus();

    function onKey(event: KeyboardEvent) {
      if (event.key !== "Tab") return;
      if (document.getElementById("unsaved-changes-title")) return;
      const items = focusableIn(root!);
      if (items.length === 0) return;
      event.preventDefault();
      event.stopPropagation();
      const current = document.activeElement as HTMLElement | null;
      const index = current ? items.indexOf(current) : -1;
      if (index === -1) {
        items[event.shiftKey ? items.length - 1 : 0]?.focus();
        return;
      }
      const next = event.shiftKey
        ? items[(index - 1 + items.length) % items.length]
        : items[(index + 1) % items.length];
      next?.focus();
    }

    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [trapFocus]);

  const widthClass = form
    ? "h-auto w-full max-w-[27rem]"
    : compact
      ? "w-full max-w-2xl max-h-[calc(100vh-4rem)]"
      : wide
        ? "h-[calc(100vh-2.5rem)] w-[min(84vw,96rem)]"
        : "w-[75vw] max-w-[72rem] max-h-[calc(100vh-4rem)]";
  const closeButton = (
    <button
          ? "w-[min(90vw,80rem)] max-h-[calc(100vh-1.5rem)]"
      data-modal-close
      tabIndex={closeTabIndex}
      className={
        form
          ? `${buttonTinyClass} absolute top-2 right-2`
          : buttonTinyClass
      }
      onClick={onClose}
      aria-label="Close"
    >
      <X className="h-3.5 w-3.5" />
    </button>
  );

  const frame = (
    <div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className={`relative flex flex-col overflow-hidden rounded-xl border border-(--line) bg-(--panel) shadow-(--shadow-sm) ${
        cornerClose ? "h-full w-full" : widthClass
      }`}
    >
      {cornerClose ? null : (
        <div
          className={`flex shrink-0 items-center border-b border-(--line) ${
            form ? "px-4 py-2 pr-10" : "justify-between px-5 py-2.5"
          }`}
        >
          <h2 className="text-[14px] font-semibold text-(--ink)">{title}</h2>
          {form ? null : closeButton}
        </div>
      )}
      <div
        className={
          form
            ? ""
            : flushBody
              ? "flex min-h-0 flex-1 flex-col overflow-hidden"
              : "min-h-0 flex-1 overflow-y-auto"
        }
      >
        {children}
      </div>
      {form ? closeButton : null}
    </div>
  );

  if (cornerClose) {
    return (
      <div className="fixed inset-0 z-50 bg-black/40">
        <div className="absolute inset-y-2 right-2 left-2 md:right-auto md:left-1/2 md:w-[calc(100vw-14.25rem)] md:-translate-x-1/2">
          <div className="relative h-full w-full">
            <button
              type="button"
              data-modal-close
              tabIndex={closeTabIndex}
              className={`${buttonTinyClass} absolute top-1.5 right-1.5 z-20 border border-(--line) bg-(--panel)`}
              onClick={onClose}
              aria-label="Close"
            >
              <X className="h-3.5 w-3.5" />
            </button>
            <div className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-xl border border-(--line) bg-(--panel) shadow-(--shadow-sm)">
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                {children}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/40 ${
        wide ? "px-[3vw] py-5" : "px-[4vw] py-8"
      }`}
    >
      {frame}
        wide ? "px-[3vw] py-5" : roomy ? "px-[3vw] py-3" : "px-[4vw] py-8"
  );
}

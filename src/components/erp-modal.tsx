"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  frameWidthClass,
  frameStyle,
  overlayClassName,
  closeClassName,
  headerClassName,
  headerAccessory,
  portal,
  trackViewport,
  lockScroll,
  bodyClassName,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  compact?: boolean;
  flushBody?: boolean;
  wide?: boolean;
  roomy?: boolean;
  form?: boolean;
  trapFocus?: boolean;
  closeTabIndex?: number;
  cornerClose?: boolean;
  frameWidthClass?: string;
  frameStyle?: React.CSSProperties;
  overlayClassName?: string;
  closeClassName?: string;
  headerClassName?: string;
  headerAccessory?: React.ReactNode;
  portal?: boolean;
  trackViewport?: boolean;
  lockScroll?: boolean;
  bodyClassName?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [viewportBox, setViewportBox] = useState<{ top: number; height: number } | null>(null);

  /* Opt-in: stops the page behind the dialog from scrolling. Nested
     dialogs restore the previous value, so the lock survives until the
     outermost one closes. */
  useEffect(() => {
    if (!lockScroll) return;
    const previous = document.body.style.overflow;
    const gutter = window.innerWidth - document.documentElement.clientWidth;
    const previousPad = document.body.style.paddingRight;
    document.body.style.overflow = "hidden";
    /* keep the page width stable so the dialog stays centred */
    if (gutter > 0) document.body.style.paddingRight = `${gutter}px`;
    return () => {
      document.body.style.overflow = previous;
      document.body.style.paddingRight = previousPad;
    };
  }, [lockScroll]);

  useEffect(() => {
    if (!trackViewport) return;
    const viewport = window.visualViewport;
    if (!viewport) return;
    const update = () => setViewportBox({ top: viewport.offsetTop, height: viewport.height });
    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
    };
  }, [trackViewport]);

  useEffect(() => {
    if (!trapFocus) return;
    const root = rootRef.current;
    if (!root) return;
    const previous = document.activeElement as HTMLElement | null;

    focusableIn(root)[0]?.focus();

    function onKey(event: KeyboardEvent) {
      if (event.key !== "Tab") return;
      if (document.getElementById("unsaved-changes-title")) return;
      if (
        !event.shiftKey &&
        (event.target as HTMLElement | null)?.closest("[data-skip-modal-tab]")
      ) {
        return;
      }
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
    return () => {
      document.removeEventListener("keydown", onKey, true);
      if (previous?.isConnected) previous.focus();
    };
  }, [trapFocus]);

  const widthClass =
    frameWidthClass ||
    (form
      ? "h-auto w-full max-w-[27rem]"
      : compact
        ? "w-full max-w-2xl max-h-[calc(100vh-4rem)]"
        : wide
          ? "h-[calc(100vh-2.5rem)] w-[min(84vw,96rem)]"
          : roomy
            ? "w-[min(90vw,80rem)] max-h-[calc(100vh-1.5rem)]"
            : "w-[75vw] max-w-[72rem] max-h-[calc(100vh-4rem)]");
  const closeButton = (
    <button
      type="button"
      data-modal-close
      tabIndex={closeTabIndex}
      className={
        form
          ? `${closeClassName || buttonTinyClass} absolute top-2 right-2`
          : closeClassName || buttonTinyClass
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
      style={frameStyle}
    >
      {cornerClose ? null : (
        <div
          className={`flex shrink-0 items-center border-b border-(--line) ${
            form ? "px-4 py-2 pr-10" : headerClassName || "justify-between px-5 py-2.5"
          }`}
        >
          <div className="flex min-w-0 items-center gap-2">
            <h2 className={`truncate text-[14px] font-semibold text-(--ink) ${headerClassName ? "min-w-0" : ""}`}>{title}</h2>
            {headerAccessory}
          </div>
          {form ? null : closeButton}
        </div>
      )}
      <div
        className={
          bodyClassName
            ? bodyClassName
            : form
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
        <div className="absolute inset-y-2 right-2 left-2 md:right-auto md:left-1/2 md:w-[calc(100vw-11rem)] md:-translate-x-1/2">
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

  const overlayPadding =
    overlayClassName ??
    (wide ? "px-[3vw] py-5" : roomy ? "px-[3vw] py-3" : "px-[4vw] py-8");
  const overlay = (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/40 ${overlayPadding}`}
      style={
        trackViewport && viewportBox
          ? { top: viewportBox.top, height: viewportBox.height, bottom: "auto" }
          : undefined
      }
    >
      {frame}
    </div>
  );

  if (portal && typeof document !== "undefined") {
    return createPortal(overlay, document.body);
  }
  return overlay;
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import { inputClass } from "@/components/ui";

export type SearchableOption = {
  id: string;
  label: string;
};

export function SearchableSelect({
  value,
  options,
  onChange,
  placeholder = "Type to search",
  disabled,
  className,
}: {
  value: string;
  options: SearchableOption[];
  onChange: (id: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}) {
  const selected = options.find((opt) => opt.id === value) ?? null;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [menuPos, setMenuPos] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((opt) => opt.label.toLowerCase().includes(q));
  }, [options, query]);

  useEffect(() => {
    if (!open) setQuery(selected?.label ?? "");
  }, [open, selected?.label, value]);

  useEffect(() => {
    setActive(0);
  }, [query, open]);

  useEffect(() => {
    function onDoc(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        const menu = (event.target as HTMLElement).closest(
          ".erp-searchable-menu",
        );
        if (menu) return;
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    if (!open || !inputRef.current) {
      setMenuPos(null);
      return;
    }
    function place() {
      const box = inputRef.current?.getBoundingClientRect();
      if (!box) return;
      setMenuPos({
        top: box.bottom + 2,
        left: box.left,
        width: Math.max(box.width, 160),
      });
    }
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, filtered.length]);

  function pick(id: string) {
    const label = options.find((opt) => opt.id === id)?.label ?? "";
    onChange(id);
    setQuery(label);
    setOpen(false);
  }

  return (
    <div ref={rootRef} className={`relative ${className ?? ""}`} data-searchable-select>
      <input
        ref={inputRef}
        className={`${inputClass} pr-7`}
        value={open ? query : (selected?.label ?? query)}
        disabled={disabled}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        onFocus={() => {
          if (disabled) return;
          setOpen(true);
          setQuery("");
        }}
        onBlur={(e) => {
          const next = e.relatedTarget as Node | null;
          if (next && rootRef.current?.contains(next)) return;
          if (
            next instanceof Element &&
            next.closest(".erp-searchable-menu")
          ) {
            return;
          }
          setOpen(false);
        }}
        onChange={(e) => {
          setOpen(true);
          setQuery(e.target.value);
        }}
        onKeyDown={(e) => {
          if (disabled) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            e.stopPropagation();
            setOpen(true);
            setActive((i) =>
              filtered.length ? Math.min(i + 1, filtered.length - 1) : 0,
            );
            return;
          }
          if (e.key === "ArrowUp") {
            e.preventDefault();
            e.stopPropagation();
            setOpen(true);
            setActive((i) => Math.max(i - 1, 0));
            return;
          }
          if (e.key === "Tab") {
            setOpen(false);
            return;
          }
          if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            setOpen(false);
            return;
          }
          if (e.key === "Enter" && open) {
            e.preventDefault();
            e.stopPropagation();
            const choice = filtered[active] ?? filtered[0];
            if (choice) pick(choice.id);
          }
        }}
      />
      <ChevronDown className="pointer-events-none absolute top-1/2 right-2 h-3.5 w-3.5 -translate-y-1/2 text-(--muted)" />
      {open && !disabled && menuPos && typeof document !== "undefined"
        ? createPortal(
            <ul
              className="erp-searchable-menu max-h-48 overflow-y-auto rounded-md border border-(--line) bg-white shadow-(--shadow-sm)"
              style={{
                position: "fixed",
                top: menuPos.top,
                left: menuPos.left,
                width: menuPos.width,
                zIndex: 80,
              }}
            >
              {filtered.length === 0 ? (
                <li className="px-2.5 py-1.5 text-[12px] text-(--muted)">
                  No match
                </li>
              ) : (
                filtered.map((opt, index) => (
                  <li key={opt.id}>
                    <button
                      type="button"
                      tabIndex={-1}
                      className={`w-full px-2.5 py-1.5 text-left text-[12.5px] hover:bg-(--panel-sunken) ${
                        index === active
                          ? "bg-(--accent-soft) font-semibold text-(--accent)"
                          : opt.id === value
                            ? "font-semibold text-(--accent)"
                            : ""
                      }`}
                      onMouseDown={(e) => e.preventDefault()}
                      onMouseEnter={() => setActive(index)}
                      onClick={() => pick(opt.id)}
                    >
                      {opt.label}
                    </button>
                  </li>
                ))
              )}
            </ul>,
            document.body,
          )
        : null}
    </div>
  );
}

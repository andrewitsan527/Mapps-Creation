"use client";

import { useEffect, useRef, useState } from "react";
import { buttonClass, buttonGhostClass } from "@/components/ui";

function stableString(value: unknown) {
  return JSON.stringify(normalize(value));
}

function normalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return Object.keys(record)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = normalize(record[key]);
        return acc;
      }, {});
  }
  return value;
}

export function useUnsavedClose({
  active,
  current,
  onDiscard,
  onSaveDraft,
}: {
  active: boolean;
  current: unknown;
  onDiscard: () => void;
  onSaveDraft?: () => boolean | void;
}) {
  const baseline = useRef<string | null>(null);
  const discardRef = useRef(onDiscard);
  const draftRef = useRef(onSaveDraft);
  discardRef.current = onDiscard;
  draftRef.current = onSaveDraft;
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!active) {
      baseline.current = null;
      setConfirming(false);
      return;
    }
    if (baseline.current === null) {
      baseline.current = stableString(current);
    }
  }, [active, current]);

  function requestClose() {
    const changed =
      active &&
      baseline.current !== null &&
      baseline.current !== stableString(current);
    if (!changed) {
      discardRef.current();
      return;
    }
    setConfirming(true);
  }

  function saveDraft() {
    const saved = draftRef.current?.();
    if (saved === false) {
      setConfirming(false);
      return;
    }
    setConfirming(false);
  }

  useEffect(() => {
    if (!confirming || !onSaveDraft) return;
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      setConfirming(false);
    }
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [confirming, onSaveDraft]);

  const dialog = confirming ? (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-4"
      onMouseDown={onSaveDraft ? () => setConfirming(false) : undefined}
    >
      <div
        className="w-full max-w-sm rounded-xl border border-(--line) bg-(--panel) p-4 shadow-(--shadow-sm)"
        role="dialog"
        aria-labelledby="unsaved-changes-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <h2 id="unsaved-changes-title" className="text-[15px] font-semibold text-(--ink)">
          Unsaved Changes
        </h2>
        <p className="mt-1.5 text-[13px] text-(--muted)">
          {onSaveDraft
            ? "What would you like to do with this entry?"
            : "You have unsaved changes. What would you like to do?"}
        </p>
        <div className="mt-4 flex justify-end gap-1.5">
          {onSaveDraft ? (
            <button type="button" className={buttonGhostClass} onClick={() => setConfirming(false)}>
              Cancel
            </button>
          ) : null}
          {onSaveDraft ? null : (
            <button type="button" className={buttonClass} onClick={() => setConfirming(false)}>
              Continue Editing
            </button>
          )}
          <button
            type="button"
            className={buttonGhostClass}
            onClick={() => {
              setConfirming(false);
              discardRef.current();
            }}
          >
            {onSaveDraft ? "Discard" : "Discard & Close"}
          </button>
          {onSaveDraft ? (
            <button type="button" className={buttonClass} onClick={saveDraft}>
              Save Draft
            </button>
          ) : null}
        </div>
      </div>
    </div>
  ) : null;

  return { requestClose, dialog };
}

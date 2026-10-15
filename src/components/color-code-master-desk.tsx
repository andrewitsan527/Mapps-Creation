"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Search, Trash2, X } from "lucide-react";
import { ErpModal as Overlay } from "@/components/erp-modal";
import { useUnsavedClose } from "@/components/unsaved-changes";
import {
  Field,
  Metric,
  MetricStrip,
  Panel,
  TableWrap,
  buttonClass,
  buttonGhostClass,
  buttonTinyClass,
  inputClass,
} from "@/components/ui";

import {
  createColorQuality,
  deleteColorQuality,
  updateColorQuality,
  type ColorQualityRecord,
} from "@/server/actions/color-codes";

type ColorCodeRow = {
  id: string;
  code: string;
  name: string;
};

type DraftQuality = {
  id: string;
  displayNo: number;
  qualityName: string;
  codes: ColorCodeRow[];
};

function blankCode(): ColorCodeRow {
  return { id: crypto.randomUUID(), code: "", name: "" };
}

function blankQuality(displayNo: number): DraftQuality {
  return {
    id: "",
    displayNo,
    qualityName: "",
    codes: [blankCode()],
  };
}

function codeKey(value: string) {
  return value.trim();
}

type FieldIssue = {
  message: string;
  focus: string;
};

function caretCanLeave(
  input: HTMLInputElement,
  key: "ArrowUp" | "ArrowDown",
) {
  const start = input.selectionStart;
  const end = input.selectionEnd;
  if (start == null || end == null || start !== end) return false;
  if (key === "ArrowUp") return start === 0;
  return end === input.value.length;
}

const controlClass = inputClass;

export function ColorCodeMasterDesk({
  qualities,
}: {
  qualities: ColorQualityRecord[];
}) {
  const [rows, setRows] = useState<ColorQualityRecord[]>(qualities);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<DraftQuality | null>(null);
  const [mode, setMode] = useState<"create" | "edit" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [invalidFocus, setInvalidFocus] = useState<string | null>(null);
  const [focusNonce, setFocusNonce] = useState(0);
  const pendingFocus = useRef<string | null>(null);
  const openerRef = useRef<string>("add");
  const qualityNameRef = useRef<HTMLInputElement>(null);
  const addCodeRef = useRef<HTMLButtonElement>(null);
  const addQualityRef = useRef<HTMLButtonElement>(null);
  const fieldRefs = useRef(new Map<string, HTMLInputElement>());

  function requestFocus(key: string) {
    pendingFocus.current = key;
    setFocusNonce((nonce) => nonce + 1);
  }

  useEffect(() => {
    const key = pendingFocus.current;
    if (!key || !draft || !mode) return;
    const timer = window.setTimeout(() => {
      if (pendingFocus.current !== key) return;
      pendingFocus.current = null;
      const node =
        key === "quality"
          ? qualityNameRef.current
          : key === "add"
            ? addCodeRef.current
            : fieldRefs.current.get(key);
      if (!node?.isConnected) return;
      node.focus();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [focusNonce, draft, mode]);

  useEffect(() => {
    setRows(qualities);
  }, [qualities]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => row.qualityName.toLowerCase().includes(q));
  }, [query, rows]);

  const numberById = useMemo(() => {
    const numbers = new Map<string, number>();
    rows.forEach((row, index) => numbers.set(row.id, index + 1));
    return numbers;
  }, [rows]);

  const codeCount = rows.reduce((sum, row) => sum + row.codes.length, 0);

  function patchQuality(qualityName: string) {
    setDraft((prev) => (prev ? { ...prev, qualityName } : prev));
    setError(null);
    setInvalidFocus(null);
  }

  function patchCode(id: string, partial: Partial<ColorCodeRow>) {
    setDraft((prev) =>
      prev
        ? {
            ...prev,
            codes: prev.codes.map((row) =>
              row.id === id ? { ...row, ...partial } : row,
            ),
          }
        : prev,
    );
    setError(null);
    setInvalidFocus(null);
  }

  function addCode() {
    const row = blankCode();
    setDraft((prev) =>
      prev ? { ...prev, codes: [...prev.codes, row] } : prev,
    );
    setError(null);
    setInvalidFocus(null);
    requestFocus(`${row.id}:code`);
  }

  function removeCode(id: string) {
    const current = draft?.codes ?? [];
    const index = current.findIndex((row) => row.id === id);
    const remaining = current.filter((row) => row.id !== id);
    const neighbor = remaining[index] ?? remaining[index - 1];
    setDraft((prev) =>
      prev ? { ...prev, codes: prev.codes.filter((row) => row.id !== id) } : prev,
    );
    setError(null);
    setInvalidFocus(null);
    requestFocus(neighbor ? `${neighbor.id}:code` : "add");
  }

  function openCreate() {
    openerRef.current = "add";
    setDraft(blankQuality(rows.length + 1));
    setMode("create");
    setError(null);
    setInvalidFocus(null);
    requestFocus("quality");
  }

  function openEdit(row: ColorQualityRecord) {
    openerRef.current = row.id;
    setDraft({
      id: row.id,
      displayNo: (numberById.get(row.id) ?? rows.length) || 1,
      qualityName: row.qualityName,
      codes: row.codes.map((code) => ({ ...code })),
    });
    setMode("edit");
    setError(null);
    setInvalidFocus(null);
    requestFocus("quality");
  }

  function closeModal() {
    const opener = openerRef.current;
    setDraft(null);
    setMode(null);
    setError(null);
    setInvalidFocus(null);
    window.requestAnimationFrame(() => {
      if (opener === "add") {
        addQualityRef.current?.focus();
        return;
      }
      const button = document.querySelector<HTMLElement>(
        `[data-quality-focus="${CSS.escape(opener)}"]`,
      );
      (button ?? addQualityRef.current)?.focus();
    });
  }

  function moveBetweenRows(
    event: React.KeyboardEvent<HTMLInputElement>,
    index: number,
    field: "code" | "name",
  ) {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    if (!draft) return;
    if (!caretCanLeave(event.currentTarget, event.key)) return;
    const nextIndex = event.key === "ArrowUp" ? index - 1 : index + 1;
    const next = draft.codes[nextIndex];
    if (!next) return;
    const node = fieldRefs.current.get(`${next.id}:${field}`);
    if (!node) return;
    event.preventDefault();
    node.focus();
    const position = event.key === "ArrowUp" ? node.value.length : 0;
    node.setSelectionRange(position, position);
  }

  const unsaved = useUnsavedClose({
    active: mode != null && draft != null,
    current: draft,
    onDiscard: closeModal,
  });

  function validate(entry: DraftQuality): FieldIssue | null {
    if (!entry.qualityName.trim()) {
      return { message: "Enter quality name.", focus: "quality" };
    }
    if (entry.codes.length === 0) {
      return { message: "Add at least one color code.", focus: "add" };
    }
    const usedElsewhere = new Map<string, string>();
    for (const row of rows) {
      if (row.id === entry.id) continue;
      for (const code of row.codes) {
        const key = codeKey(code.code);
        if (key) usedElsewhere.set(key, row.qualityName);
      }
    }
    const seen = new Set<string>();
    for (const code of entry.codes) {
      const key = codeKey(code.code);
      if (!key) {
        return {
          message: "Enter a color code and color name on every row.",
          focus: `${code.id}:code`,
        };
      }
      if (!code.name.trim()) {
        return {
          message: "Enter a color code and color name on every row.",
          focus: `${code.id}:name`,
        };
      }
      if (seen.has(key)) {
        return {
          message: `Color code "${key}" is entered more than once.`,
          focus: `${code.id}:code`,
        };
      }
      const owner = usedElsewhere.get(key);
      if (owner) {
        return {
          message: `Color code "${key}" is already used on ${owner}.`,
          focus: `${code.id}:code`,
        };
      }
      seen.add(key);
    }
    return null;
  }

  function focusForServerError(message: string, entry: DraftQuality) {
    if (/quality name/i.test(message)) return "quality";
    const match = entry.codes.find((code) =>
      message.includes(`"${codeKey(code.code)}"`),
    );
    return match ? `${match.id}:code` : "quality";
  }

  function showIssue(issue: FieldIssue) {
    setError(issue.message);
    setInvalidFocus(issue.focus);
    requestFocus(issue.focus);
  }

  async function saveQuality() {
    if (!draft || !mode || saving) return;
    const issue = validate(draft);
    if (issue) {
      showIssue(issue);
      return;
    }
    const input = {
      qualityName: draft.qualityName.trim(),
      codes: draft.codes.map((code) => ({
        id: mode === "edit" ? code.id : undefined,
        code: code.code.trim(),
        name: code.name.trim(),
      })),
    };
    setSaving(true);
    try {
      const saved =
        mode === "create"
          ? await createColorQuality(input)
          : await updateColorQuality(draft.id, input);
      setRows((prev) =>
        mode === "create"
          ? [...prev, saved]
          : prev.map((row) => (row.id === saved.id ? saved : row)),
      );
      closeModal();
      setNotice(
        mode === "create" ? `${saved.qualityName} saved.` : `${saved.qualityName} updated.`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not save quality.";
      showIssue({ message, focus: focusForServerError(message, draft) });
    } finally {
      setSaving(false);
    }
  }

  async function deleteQuality(row: ColorQualityRecord) {
    if (saving) return;
    if (!window.confirm(`Delete ${row.qualityName}?`)) return;
    setSaving(true);
    try {
      await deleteColorQuality(row.id);
      setRows((prev) => prev.filter((item) => item.id !== row.id));
      setNotice(`${row.qualityName} deleted.`);
      window.requestAnimationFrame(() => addQualityRef.current?.focus());
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Could not delete quality.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="ms-page">
      <div className="ms-stage">
      {notice ? (
        <div className="gb-toast-wrap" role="status" aria-live="polite">
          <div className="gb-toast" data-tone="ok">
            <span className="gb-toast-text">{notice}</span>
            <button
              type="button"
              className="gb-toast-close"
              onClick={() => setNotice(null)}
              aria-label="Dismiss notification"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ) : null}

      <MetricStrip className="aw-metrics ms-metrics grid-cols-2">
        <Metric label="Qualities" value={rows.length} />
        <Metric label="Color codes" value={codeCount} tone="accent" />
      </MetricStrip>

      <Panel
        title="Color Code"
        flush
        className="ms-panel"
        action={
          <div className="ms-bar-tools">
            <label className="aw-search">
              <span className="sr-only">Search quality name</span>
              <input
                value={query}
                placeholder="Search quality name"
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setQuery("");
                }}
              />
              {query ? (
                <button
                  type="button"
                  className="aw-search-clear"
                  aria-label="Clear search"
                  onClick={() => setQuery("")}
                >
                  <X className="h-3 w-3" />
                </button>
              ) : (
                <Search className="aw-search-icon h-3.5 w-3.5" aria-hidden />
              )}
            </label>
            <button
            ref={addQualityRef}
            className={buttonClass}
            type="button"
            onClick={openCreate}
          >
            <Plus className="h-3.5 w-3.5" />
            Add Quality
          </button>
          </div>
        }
      >
        {filtered.length === 0 ? (
          <div className="px-3 py-8 text-center">
            <p className="text-[12.5px] text-(--muted)">
              {rows.length === 0
                ? "No qualities yet. Add a quality to enter color codes."
                : "No matching qualities."}
            </p>
            {rows.length === 0 ? (
              <button
                type="button"
                className={`${buttonClass} mt-3`}
                onClick={openCreate}
              >
                <Plus className="h-3.5 w-3.5" />
                Add Quality
              </button>
            ) : null}
          </div>
        ) : (
          <TableWrap maxHeight={false}>
            <table className="erp-table erp-register ms-reg w-full">
              <colgroup>
                <col className="w-14" />
                <col />
                <col className="w-24" />
                <col className="w-[1%]" />
              </colgroup>
              <thead>
                <tr>
                  <th className="w-14 !text-center">No.</th>
                  <th>Quality Name</th>
                  <th className="w-24 !text-right">Codes</th>
                  <th className="!text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr
                    key={row.id}
                    className="cursor-pointer"
                    onClick={() => openEdit(row)}
                  >
                    <td className="w-14 text-center text-(--muted) tabular-nums">
                      {numberById.get(row.id)}
                    </td>
                    <td className="max-w-0 font-medium">
                      <span className="block truncate" title={row.qualityName}>
                        {row.qualityName}
                      </span>
                    </td>
                    <td className="w-24 text-right tabular-nums">
                      {row.codes.length}
                    </td>
                    <td className="w-[1%] whitespace-nowrap">
                      <div className="flex justify-end gap-1.5">
                        <button
                          type="button"
                          className={`${buttonTinyClass} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-(--accent)`}
                          data-quality-focus={row.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            openEdit(row);
                          }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className={`${buttonTinyClass} hover:border-(--danger)/40 hover:text-(--danger) focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-(--accent)`}
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteQuality(row);
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length > 0 ? (
                  <tr className="ms-filler" aria-hidden>
                    <td />
                    <td />
                    <td />
                    <td />
                  </tr>
                ) : null}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Panel>

      {unsaved.dialog}
      {draft && mode ? (
        <Overlay
          title={mode === "create" ? "New Quality" : "Edit Quality"}
          onClose={unsaved.requestClose}
          flushBody
          trapFocus
          frameWidthClass="ms-sheet ms-sheet-md h-[min(600px,calc(100%-4rem))] min-h-0"
        >
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="ms-form ms-form-fill">
              {error ? (
                <p
                  id="color-code-form-error"
                  role="alert"
                  className="rounded-md border border-(--danger)/40 bg-(--danger-soft) px-2 py-1.5 text-[11px] text-(--danger)"
                >
                  {error}
                </p>
              ) : null}

              <section className="ms-block">
                <p className="ms-block-head">Quality</p>
                <div className="ms-block-body">
                <div className="flex items-end gap-3">
                  <p className="flex h-[1.9rem] shrink-0 items-center text-[13px] font-semibold tabular-nums text-(--ink)">
                    {draft.displayNo}
                  </p>
                  <Field
                    label="Quality Name"
                    className="min-w-0 flex-1 sm:max-w-md"
                  >
                    <input
                      ref={qualityNameRef}
                      id="color-quality-name"
                      className={controlClass}
                      value={draft.qualityName}
                      required
                      aria-invalid={invalidFocus === "quality"}
                      aria-describedby={
                        invalidFocus === "quality"
                          ? "color-code-form-error"
                          : undefined
                      }
                      onChange={(e) => patchQuality(e.target.value)}
                    />
                  </Field>
                </div>
                </div>
              </section>

              <section className="ms-block">
                <p className="ms-block-head">Color Codes</p>
                <div className="ms-block-body">
                <div className="space-y-3">
                  {draft.codes.map((code, index) => (
                    <div key={code.id} className="ms-line">
                      <Field label="Color Code">
                        <input
                          ref={(node) => {
                            const key = `${code.id}:code`;
                            if (node) fieldRefs.current.set(key, node);
                            else fieldRefs.current.delete(key);
                          }}
                          className={controlClass}
                          value={code.code}
                          required
                          aria-invalid={invalidFocus === `${code.id}:code`}
                          aria-describedby={
                            invalidFocus === `${code.id}:code`
                              ? "color-code-form-error"
                              : undefined
                          }
                          onKeyDown={(event) =>
                            moveBetweenRows(event, index, "code")
                          }
                          onChange={(e) =>
                            patchCode(code.id, { code: e.target.value })
                          }
                        />
                      </Field>
                      <Field label="Color Name">
                        <input
                          ref={(node) => {
                            const key = `${code.id}:name`;
                            if (node) fieldRefs.current.set(key, node);
                            else fieldRefs.current.delete(key);
                          }}
                          className={controlClass}
                          value={code.name}
                          required
                          aria-invalid={invalidFocus === `${code.id}:name`}
                          aria-describedby={
                            invalidFocus === `${code.id}:name`
                              ? "color-code-form-error"
                              : undefined
                          }
                          onKeyDown={(event) =>
                            moveBetweenRows(event, index, "name")
                          }
                          onChange={(e) =>
                            patchCode(code.id, { name: e.target.value })
                          }
                        />
                      </Field>
                      <div className="flex items-end">
                        <button
                          type="button"
                          className={`${buttonTinyClass} h-[1.9rem]`}
                          onClick={() => removeCode(code.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                  <button
                    ref={addCodeRef}
                    type="button"
                    className={buttonGhostClass}
                    onClick={addCode}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Color Code
                  </button>
                </div>
                </div>
              </section>
            </div>

            <div className="ms-foot">
              <button
                type="button"
                className={buttonGhostClass}
                onClick={unsaved.requestClose}
              >
                Cancel
              </button>
              <button
                type="button"
                className={buttonClass}
                disabled={saving}
                onClick={() => void saveQuality()}
              >
                {mode === "create" ? "Save Quality" : "Update Quality"}
              </button>
            </div>
          </div>
        </Overlay>
      ) : null}
      </div>
    </div>
  );
}
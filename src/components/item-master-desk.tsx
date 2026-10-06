"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronRight, Plus, Search, Shirt } from "lucide-react";
import { ErpModal as Overlay } from "@/components/erp-modal";
import { useUnsavedClose } from "@/components/unsaved-changes";
import {
  EmptyState,
  Field,
  Metric,
  MetricStrip,
  PageHeader,
  Panel,
  TableWrap,
  buttonClass,
  buttonGhostClass,
  buttonTinyClass,
  inputClass,
} from "@/components/ui";
import { type LocalItem } from "@/lib/local-workflow";
import {
  createItem,
  updateItem,
  type ItemInput,
  type ItemRecord,
} from "@/server/actions/items";

/** Initial options from finished-item Rate Per; easy to change later. */
const ITEM_RATE_PER = ["Mts", "Pcs"] as const;

function blankItem(): LocalItem {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    itemName: "",
    quality: "",
    itemCategories: "",
    itemGroup: "",
    hsnCode: "",
    gstPercent: "",
    descriptionForGst: "",
    itemRatePer: "",
    openingPcs: "",
    openingMts: "",
    openingValue: "",
    ratePerPcs: "",
    ratePerMts: "",
    purchaseRatePerPcs: "",
    purchaseRatePerMts: "",
    itemFold: "",
    imagePath1: "",
    imagePath2: "",
    imagePath3: "",
    imagePath4: "",
    imagePath5: "",
    createdAt: now,
    updatedAt: now,
  };
}

function toLocal(row: ItemRecord): LocalItem {
  return row;
}

function toInput(entry: LocalItem): ItemInput {
  return {
    itemName: entry.itemName,
    quality: entry.quality,
    itemCategories: entry.itemCategories,
    itemGroup: entry.itemGroup,
    hsnCode: entry.hsnCode,
    gstPercent: entry.gstPercent,
    descriptionForGst: entry.descriptionForGst,
    itemRatePer: entry.itemRatePer,
    openingPcs: entry.openingPcs,
    openingMts: entry.openingMts,
    openingValue: entry.openingValue,
    ratePerPcs: entry.ratePerPcs,
    ratePerMts: entry.ratePerMts,
    purchaseRatePerPcs: entry.purchaseRatePerPcs,
    purchaseRatePerMts: entry.purchaseRatePerMts,
    itemFold: entry.itemFold,
    imagePath1: entry.imagePath1,
    imagePath2: entry.imagePath2,
    imagePath3: entry.imagePath3,
    imagePath4: entry.imagePath4,
    imagePath5: entry.imagePath5,
  };
}

function numericOk(raw: string) {
  if (!raw.trim()) return true;
  return Number.isFinite(Number(raw));
}

function FormSection({
  title,
  collapsible,
  open,
  onToggle,
  children,
}: {
  title: string;
  collapsible?: boolean;
  open?: boolean;
  onToggle?: () => void;
  children: React.ReactNode;
}) {
  const visible = !collapsible || open;
  return (
    <div className="border-b border-(--line) pb-1.5 last:border-b-0">
      {collapsible ? (
        <button
          type="button"
          className="mb-1 flex w-full items-center gap-1 text-left"
          onClick={onToggle}
        >
          <ChevronRight
            className={`h-3.5 w-3.5 shrink-0 text-(--muted) ${
              visible ? "rotate-90" : ""
            }`}
          />
          <span className="band-label mb-0">{title}</span>
        </button>
      ) : (
        <p className="band-label mb-1">{title}</p>
      )}
      {visible ? children : null}
    </div>
  );
}

export function ItemMasterDesk({ items }: { items: ItemRecord[] }) {
  const [rows, setRows] = useState<LocalItem[]>(() => items.map(toLocal));
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<LocalItem | null>(null);
  const [mode, setMode] = useState<"create" | "edit" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [imagesOpen, setImagesOpen] = useState(false);

  useEffect(() => {
    setRows(items.map(toLocal));
  }, [items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => row.itemName.toLowerCase().includes(q));
  }, [query, rows]);

  function patch(partial: Partial<LocalItem>) {
    setDraft((prev) => (prev ? { ...prev, ...partial } : prev));
    setError(null);
  }

  function openCreate() {
    setDraft(blankItem());
    setMode("create");
    setError(null);
    setImagesOpen(false);
  }

  function openEdit(row: LocalItem) {
    setDraft({ ...row });
    setMode("edit");
    setError(null);
    setImagesOpen(false);
  }

  function closeModal() {
    setDraft(null);
    setMode(null);
    setError(null);
  }

  const unsaved = useUnsavedClose({
    active: mode != null && draft != null,
    current: draft,
    onDiscard: closeModal,
  });

  function validate(entry: LocalItem) {
    if (!entry.itemName.trim()) return "Enter item name.";
    const numericFields: [string, string][] = [
      ["GST Perc.", entry.gstPercent],
      ["Opening Pcs", entry.openingPcs],
      ["Opening Mts", entry.openingMts],
      ["Opening Value", entry.openingValue],
      ["Rate Per Pcs", entry.ratePerPcs],
      ["Rate Per Mts", entry.ratePerMts],
      ["Pur. Rate Per Pcs", entry.purchaseRatePerPcs],
      ["Pur. Rate Per Mts", entry.purchaseRatePerMts],
      ["Item Fold", entry.itemFold],
    ];
    for (const [label, value] of numericFields) {
      if (!numericOk(value)) return `${label} must be a number.`;
    }
    return null;
  }

  async function saveItem() {
    if (!draft || !mode || saving) return;
    const message = validate(draft);
    if (message) {
      setError(message);
      return;
    }
    setSaving(true);
    try {
      const saved =
        mode === "create"
          ? await createItem(toInput(draft))
          : await updateItem(draft.id, toInput(draft));
      const local = toLocal(saved);
      setRows((prev) =>
        mode === "create"
          ? [local, ...prev]
          : prev.map((row) => (row.id === local.id ? local : row)),
      );
      closeModal();
      setNotice(
        mode === "create"
          ? `${local.itemName} saved.`
          : `${local.itemName} updated.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save item.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <PageHeader
        title="Item Master"
        eyebrow="Masters"
        icon={Shirt}
        description="Finished items — not linked to transactions yet."
        actions={
          <button className={buttonClass} type="button" onClick={openCreate}>
            <Plus className="h-3.5 w-3.5" />
            Add Item
          </button>
        }
      />

      {notice ? (
        <div className="flex items-center justify-between rounded-md border border-(--line) bg-(--panel-alt) px-2.5 py-1.5 text-[12px]">
          <span>{notice}</span>
          <button
            type="button"
            className={buttonTinyClass}
            onClick={() => setNotice(null)}
          >
            Dismiss
          </button>
        </div>
      ) : null}

      <MetricStrip className="grid-cols-2 sm:grid-cols-3">
        <Metric label="Total items" value={rows.length} />
        <Metric
          label="With HSN"
          value={rows.filter((row) => row.hsnCode.trim()).length}
          tone="accent"
        />
        <Metric
          label="With GST %"
          value={rows.filter((row) => row.gstPercent.trim()).length}
        />
      </MetricStrip>

      <Panel
        title="Item Master"
        flush
        action={
          <div className="flex items-center gap-1.5">
            <Search className="h-3.5 w-3.5 shrink-0 text-(--muted)" />
            <input
              className={`${inputClass} w-56`}
              placeholder="Search item name"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        }
      >
        {filtered.length === 0 ? (
          <div className="p-2.5">
            <EmptyState icon={Shirt} text="No item records." />
          </div>
        ) : (
          <TableWrap>
            <table className="erp-table erp-register">
              <thead>
                <tr>
                  <th>Item Name</th>
                  <th>Quality</th>
                  <th>Item Category</th>
                  <th>Item Group</th>
                  <th>HSN Code</th>
                  <th>GST %</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr
                    key={row.id}
                    className="cursor-pointer hover:bg-(--panel-sunken)"
                    onClick={() => openEdit(row)}
                  >
                    <td className="font-medium">{row.itemName}</td>
                    <td>{row.quality || "—"}</td>
                    <td>{row.itemCategories || "—"}</td>
                    <td>{row.itemGroup || "—"}</td>
                    <td>{row.hsnCode || "—"}</td>
                    <td className="tabular-nums">{row.gstPercent || "—"}</td>
                    <td>
                      <button
                        type="button"
                        className={buttonTinyClass}
                        onClick={(e) => {
                          e.stopPropagation();
                          openEdit(row);
                        }}
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Panel>

      {unsaved.dialog}
      {draft && mode ? (
        <Overlay
          title={mode === "create" ? "New Item" : "Edit Item"}
          onClose={unsaved.requestClose}
        >
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto px-4 py-2">
              {error ? (
                <p className="rounded-md border border-(--danger)/40 bg-(--danger-soft) px-2 py-1.5 text-[11px] text-(--danger)">
                  {error}
                </p>
              ) : null}

              <FormSection title="Basic details">
                <div className="grid grid-cols-4 gap-x-2 gap-y-1">
                  <Field label="Item Name" className="col-span-2">
                    <input
                      className={inputClass}
                      value={draft.itemName}
                      onChange={(e) => patch({ itemName: e.target.value })}
                    />
                  </Field>
                  <Field label="Quality">
                    <input
                      className={inputClass}
                      value={draft.quality}
                      onChange={(e) => patch({ quality: e.target.value })}
                    />
                  </Field>
                  <Field label="Item Categories">
                    <input
                      className={inputClass}
                      value={draft.itemCategories}
                      onChange={(e) =>
                        patch({ itemCategories: e.target.value })
                      }
                    />
                  </Field>
                  <Field label="Item Group">
                    <input
                      className={inputClass}
                      value={draft.itemGroup}
                      onChange={(e) => patch({ itemGroup: e.target.value })}
                    />
                  </Field>
                  <Field label="HSN Code">
                    <input
                      className={inputClass}
                      value={draft.hsnCode}
                      onChange={(e) => patch({ hsnCode: e.target.value })}
                    />
                  </Field>
                  <Field label="GST Perc. (%)">
                    <input
                      className={inputClass}
                      inputMode="decimal"
                      value={draft.gstPercent}
                      onChange={(e) => patch({ gstPercent: e.target.value })}
                    />
                  </Field>
                </div>
              </FormSection>

              <FormSection title="GST / description">
                <div className="grid grid-cols-4 gap-x-2 gap-y-1">
                  <Field label="Description For GST" className="col-span-4">
                    <textarea
                      className={inputClass}
                      rows={1}
                      value={draft.descriptionForGst}
                      onChange={(e) =>
                        patch({ descriptionForGst: e.target.value })
                      }
                    />
                  </Field>
                </div>
              </FormSection>

              <FormSection title="Opening / pricing">
                <div className="grid grid-cols-4 gap-x-2 gap-y-1">
                  <Field label="Item Rate Per">
                    <select
                      className={inputClass}
                      value={draft.itemRatePer}
                      onChange={(e) => patch({ itemRatePer: e.target.value })}
                    >
                      <option value="">Select</option>
                      {ITEM_RATE_PER.map((unit) => (
                        <option key={unit} value={unit}>
                          {unit}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Opening Pcs">
                    <input
                      className={inputClass}
                      inputMode="decimal"
                      value={draft.openingPcs}
                      onChange={(e) => patch({ openingPcs: e.target.value })}
                    />
                  </Field>
                  <Field label="Opening Mts">
                    <input
                      className={inputClass}
                      inputMode="decimal"
                      value={draft.openingMts}
                      onChange={(e) => patch({ openingMts: e.target.value })}
                    />
                  </Field>
                  <Field label="Opening Value">
                    <input
                      className={inputClass}
                      inputMode="decimal"
                      value={draft.openingValue}
                      onChange={(e) => patch({ openingValue: e.target.value })}
                    />
                  </Field>
                  <Field label="Rate Per Pcs">
                    <input
                      className={inputClass}
                      inputMode="decimal"
                      value={draft.ratePerPcs}
                      onChange={(e) => patch({ ratePerPcs: e.target.value })}
                    />
                  </Field>
                  <Field label="Rate Per Mts">
                    <input
                      className={inputClass}
                      inputMode="decimal"
                      value={draft.ratePerMts}
                      onChange={(e) => patch({ ratePerMts: e.target.value })}
                    />
                  </Field>
                  <Field label="Pur. Rate Per Pcs">
                    <input
                      className={inputClass}
                      inputMode="decimal"
                      value={draft.purchaseRatePerPcs}
                      onChange={(e) =>
                        patch({ purchaseRatePerPcs: e.target.value })
                      }
                    />
                  </Field>
                  <Field label="Pur. Rate Per Mts">
                    <input
                      className={inputClass}
                      inputMode="decimal"
                      value={draft.purchaseRatePerMts}
                      onChange={(e) =>
                        patch({ purchaseRatePerMts: e.target.value })
                      }
                    />
                  </Field>
                </div>
              </FormSection>

              <FormSection title="Other">
                <div className="grid grid-cols-4 gap-x-2 gap-y-1">
                  <Field label="Item Fold">
                    <input
                      className={inputClass}
                      inputMode="decimal"
                      value={draft.itemFold}
                      onChange={(e) => patch({ itemFold: e.target.value })}
                    />
                  </Field>
                </div>
              </FormSection>

              <FormSection
                title="Item images"
                collapsible
                open={imagesOpen}
                onToggle={() => setImagesOpen((prev) => !prev)}
              >
                <div className="grid grid-cols-4 gap-x-2 gap-y-1">
                  <Field label="Image Path 1" className="col-span-2">
                    <input
                      className={inputClass}
                      value={draft.imagePath1}
                      onChange={(e) => patch({ imagePath1: e.target.value })}
                    />
                  </Field>
                  <Field label="Image Path 2" className="col-span-2">
                    <input
                      className={inputClass}
                      value={draft.imagePath2}
                      onChange={(e) => patch({ imagePath2: e.target.value })}
                    />
                  </Field>
                  <Field label="Image Path 3" className="col-span-2">
                    <input
                      className={inputClass}
                      value={draft.imagePath3}
                      onChange={(e) => patch({ imagePath3: e.target.value })}
                    />
                  </Field>
                  <Field label="Image Path 4" className="col-span-2">
                    <input
                      className={inputClass}
                      value={draft.imagePath4}
                      onChange={(e) => patch({ imagePath4: e.target.value })}
                    />
                  </Field>
                  <Field label="Image Path 5" className="col-span-2">
                    <input
                      className={inputClass}
                      value={draft.imagePath5}
                      onChange={(e) => patch({ imagePath5: e.target.value })}
                    />
                  </Field>
                </div>
              </FormSection>
            </div>

            <div className="flex shrink-0 justify-end gap-1.5 border-t border-(--line) bg-(--panel) px-4 py-2.5">
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
                onClick={() => void saveItem()}
              >
                {mode === "create" ? "Save Item" : "Update Item"}
              </button>
            </div>
          </div>
        </Overlay>
      ) : null}
    </div>
  );
}

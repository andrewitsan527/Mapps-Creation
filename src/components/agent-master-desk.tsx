"use client";

import { useEffect, useMemo, useState } from "react";
import { Briefcase, Plus, Search } from "lucide-react";
import { ErpModal as Overlay } from "@/components/erp-modal";
import { useUnsavedClose } from "@/components/unsaved-changes";
import { statusBadge } from "@/lib/format";
import {
  EmptyState,
  Field,
  FieldGroup,
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
import {
  type LocalAgent,
  type LocalAgentMasterType,
} from "@/lib/local-workflow";
import {
  createSalesAgent,
  updateSalesAgent,
  type SalesAgentInput,
  type SalesAgentRecord,
} from "@/server/actions/sales-agents";
import {
  createPurchaseAgent,
  updatePurchaseAgent,
  type PurchaseAgentInput,
  type PurchaseAgentRecord,
} from "@/server/actions/purchase-agents";

const ACCOUNT_TYPES = [
  "Commission Agent",
  "Broker",
  "Sole Selling Agent",
  "Consignment Agent",
  "Other",
] as const;

function blankAgent(masterType: LocalAgentMasterType): LocalAgent {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    name: "",
    accountType: "",
    address: "",
    city: "",
    phone: "",
    mobile: "",
    fax: "",
    residentNo: "",
    email: "",
    pan: "",
    gstin: "",
    compositeNo: "",
    registrationDate: "",
    contactPerson: "",
    masterType,
    blackListed: false,
    createdAt: now,
    updatedAt: now,
  };
}

function phoneLooksValid(raw: string) {
  const digits = raw.replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 15;
}

function emailLooksValid(raw: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw.trim());
}

function salesAgentToLocal(row: SalesAgentRecord): LocalAgent {
  return {
    id: row.id,
    name: row.agentName,
    accountType: "",
    address: row.address,
    city: row.city,
    phone: row.phoneNo,
    mobile: row.mobileNo,
    fax: row.faxNo,
    residentNo: row.residentNo,
    email: row.emailId,
    pan: row.panNo,
    gstin: row.gstin,
    compositeNo: row.compositeNo,
    registrationDate: row.registrationDate,
    contactPerson: row.contactPerson,
    masterType: "SALES AGENT",
    blackListed: row.blackListed,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function purchaseAgentToLocal(row: PurchaseAgentRecord): LocalAgent {
  return {
    id: row.id,
    name: row.agentName,
    accountType: row.accountType,
    address: row.address,
    city: row.city,
    phone: row.phoneNo,
    mobile: row.mobileNo,
    fax: row.faxNo,
    residentNo: row.residentNo,
    email: row.emailId,
    pan: row.panNo,
    gstin: row.gstin,
    compositeNo: row.compositeNo,
    registrationDate: row.registrationDate,
    contactPerson: row.contactPerson,
    masterType: "PURCHASE AGENT",
    blackListed: row.blackListed,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toPurchaseInput(entry: LocalAgent): PurchaseAgentInput {
  return {
    agentName: entry.name,
    accountType: entry.accountType,
    contactPerson: entry.contactPerson,
    mobileNo: entry.mobile,
    phoneNo: entry.phone,
    emailId: entry.email,
    address: entry.address,
    city: entry.city,
    residentNo: entry.residentNo,
    faxNo: entry.fax,
    panNo: entry.pan,
    gstin: entry.gstin,
    compositeNo: entry.compositeNo,
    registrationDate: entry.registrationDate,
    blackListed: entry.blackListed,
  };
}

function toSalesInput(entry: LocalAgent): SalesAgentInput {
  return {
    agentName: entry.name,
    contactPerson: entry.contactPerson,
    mobileNo: entry.mobile,
    phoneNo: entry.phone,
    emailId: entry.email,
    address: entry.address,
    city: entry.city,
    residentNo: entry.residentNo,
    faxNo: entry.fax,
    panNo: entry.pan,
    gstin: entry.gstin,
    compositeNo: entry.compositeNo,
    registrationDate: entry.registrationDate,
    blackListed: entry.blackListed,
  };
}

export function AgentMasterDesk({
  kind,
  salesAgents,
  purchaseAgents,
}: {
  kind: LocalAgentMasterType;
  salesAgents?: SalesAgentRecord[];
  purchaseAgents?: PurchaseAgentRecord[];
}) {
  const title = kind === "SALES AGENT" ? "Sales Agent" : "Purchase Agent";
  const description =
    kind === "SALES AGENT"
      ? "Agents used later on sale bills."
      : "Agents used later on grey purchase.";

  const isSales = kind === "SALES AGENT";
  const [rows, setRows] = useState<LocalAgent[]>(() =>
    isSales
      ? (salesAgents ?? []).map(salesAgentToLocal)
      : (purchaseAgents ?? []).map(purchaseAgentToLocal),
  );
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<LocalAgent | null>(null);
  const [mode, setMode] = useState<"create" | "edit" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setRows(
      isSales
        ? (salesAgents ?? []).map(salesAgentToLocal)
        : (purchaseAgents ?? []).map(purchaseAgentToLocal),
    );
  }, [isSales, salesAgents, purchaseAgents]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) =>
      [row.name, row.mobile, row.city, row.gstin, row.accountType, row.contactPerson]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [query, rows]);

  function patch(partial: Partial<LocalAgent>) {
    setDraft((prev) => (prev ? { ...prev, ...partial } : prev));
    setError(null);
  }

  function openCreate() {
    setDraft(blankAgent(kind));
    setMode("create");
    setError(null);
  }

  function openEdit(row: LocalAgent) {
    setDraft({ ...row });
    setMode("edit");
    setError(null);
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

  function validate(entry: LocalAgent) {
    if (!entry.name.trim()) return "Enter agent name.";
    if (!isSales && !entry.accountType.trim()) return "Select account type.";
    if (entry.mobile.trim() && !phoneLooksValid(entry.mobile)) {
      return "Enter a valid mobile number.";
    }
    if (entry.phone.trim() && !phoneLooksValid(entry.phone)) {
      return "Enter a valid phone number.";
    }
    if (entry.email.trim() && !emailLooksValid(entry.email)) {
      return "Enter a valid email ID.";
    }
    if (entry.registrationDate && Number.isNaN(Date.parse(entry.registrationDate))) {
      return "Enter a valid registration date.";
    }
    return null;
  }

  async function saveAgent() {
    if (!draft || !mode || saving) return;
    const message = validate(draft);
    if (message) {
      setError(message);
      return;
    }
    if (isSales) {
      setSaving(true);
      try {
        const saved =
          mode === "create"
            ? await createSalesAgent(toSalesInput(draft))
            : await updateSalesAgent(draft.id, toSalesInput(draft));
        const local = salesAgentToLocal(saved);
        setRows((prev) =>
          mode === "create"
            ? [local, ...prev]
            : prev.map((row) => (row.id === local.id ? local : row)),
        );
        closeModal();
        setNotice(
          mode === "create" ? `${local.name} saved.` : `${local.name} updated.`,
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not save sales agent.");
      } finally {
        setSaving(false);
      }
      return;
    }
    setSaving(true);
    try {
      const saved =
        mode === "create"
          ? await createPurchaseAgent(toPurchaseInput(draft))
          : await updatePurchaseAgent(draft.id, toPurchaseInput(draft));
      const local = purchaseAgentToLocal(saved);
      setRows((prev) =>
        mode === "create"
          ? [local, ...prev]
          : prev.map((row) => (row.id === local.id ? local : row)),
      );
      closeModal();
      setNotice(
        mode === "create" ? `${local.name} saved.` : `${local.name} updated.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save purchase agent.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <PageHeader
        title={title}
        eyebrow="Masters"
        icon={Briefcase}
        description={description}
        actions={
          <button className={buttonClass} type="button" onClick={openCreate}>
            <Plus className="h-3.5 w-3.5" />
            Add {title}
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
        <Metric label="Total agents" value={rows.length} />
        <Metric
          label="Active"
          value={rows.filter((row) => !row.blackListed).length}
          tone="accent"
        />
        <Metric
          label="Black listed"
          value={rows.filter((row) => row.blackListed).length}
          tone={rows.some((row) => row.blackListed) ? "warn" : "neutral"}
        />
      </MetricStrip>

      <Panel
        title={`${title}s`}
        flush
        action={
          <div className="flex items-center gap-1.5">
            <Search className="h-3.5 w-3.5 shrink-0 text-(--muted)" />
            <input
              className={`${inputClass} w-56`}
              placeholder="Search name, mobile, city, GSTIN"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        }
      >
        {filtered.length === 0 ? (
          <div className="p-2.5">
            <EmptyState icon={Briefcase} text={`No ${title.toLowerCase()} records.`} />
          </div>
        ) : (
          <TableWrap>
            <table className="erp-table erp-register">
              <thead>
                <tr>
                  <th>Agent Name</th>
                  <th>Mobile</th>
                  <th>City</th>
                  <th>GSTIN</th>
                  {isSales ? null : <th>Account Type</th>}
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr
                    key={row.id}
                    className={`cursor-pointer hover:bg-(--panel-sunken) ${
                      row.blackListed ? "opacity-70" : ""
                    }`}
                    onClick={() => openEdit(row)}
                  >
                    <td className="font-medium">{row.name}</td>
                    <td className="tabular-nums">{row.mobile || "—"}</td>
                    <td>{row.city || "—"}</td>
                    <td className="tabular-nums">{row.gstin || "—"}</td>
                    {isSales ? null : <td>{row.accountType || "—"}</td>}
                    <td>
                      {row.blackListed ? (
                        <span className={statusBadge("MEDIUM")}>Black Listed</span>
                      ) : (
                        <span className={statusBadge("OPEN")}>Active</span>
                      )}
                    </td>
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
          title={mode === "create" ? `New ${title}` : `Edit ${title}`}
          onClose={unsaved.requestClose}
        >
          <div className="space-y-2 px-4 py-2.5">
            {error ? (
              <p className="rounded-md border border-(--danger)/40 bg-(--danger-soft) px-2 py-1.5 text-[11px] text-(--danger)">
                {error}
              </p>
            ) : null}

            <FieldGroup label="Basic details">
              <div className="grid grid-cols-4 gap-x-2 gap-y-1.5">
                <Field label="Agent Name">
                  <input
                    className={inputClass}
                    value={draft.name}
                    onChange={(e) => patch({ name: e.target.value })}
                  />
                </Field>
                {isSales ? null : (
                  <Field label="Account Type">
                    <select
                      className={inputClass}
                      value={draft.accountType}
                      onChange={(e) => patch({ accountType: e.target.value })}
                    >
                      <option value="">Select</option>
                      {ACCOUNT_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </Field>
                )}
                <Field label="Contact Person">
                  <input
                    className={inputClass}
                    value={draft.contactPerson}
                    onChange={(e) => patch({ contactPerson: e.target.value })}
                  />
                </Field>
                <Field label="Mobile No.">
                  <input
                    className={inputClass}
                    value={draft.mobile}
                    inputMode="tel"
                    onChange={(e) => patch({ mobile: e.target.value })}
                  />
                </Field>
                <Field label="Phone No.">
                  <input
                    className={inputClass}
                    value={draft.phone}
                    inputMode="tel"
                    onChange={(e) => patch({ phone: e.target.value })}
                  />
                </Field>
                <Field label="Email ID">
                  <input
                    className={inputClass}
                    type="email"
                    value={draft.email}
                    onChange={(e) => patch({ email: e.target.value })}
                  />
                </Field>
              </div>
            </FieldGroup>

            <FieldGroup label="Address details">
              <div className="grid grid-cols-4 gap-x-2 gap-y-1.5">
                <Field label="Address" className="col-span-3">
                  <textarea
                    className={inputClass}
                    rows={2}
                    value={draft.address}
                    onChange={(e) => patch({ address: e.target.value })}
                  />
                </Field>
                <Field label="City">
                  <input
                    className={inputClass}
                    value={draft.city}
                    onChange={(e) => patch({ city: e.target.value })}
                  />
                </Field>
                <Field label="Resident No.">
                  <input
                    className={inputClass}
                    value={draft.residentNo}
                    onChange={(e) => patch({ residentNo: e.target.value })}
                  />
                </Field>
                <Field label="Fax No.">
                  <input
                    className={inputClass}
                    value={draft.fax}
                    onChange={(e) => patch({ fax: e.target.value })}
                  />
                </Field>
              </div>
            </FieldGroup>

            <FieldGroup label="Tax / registration">
              <div className="grid grid-cols-4 gap-x-2 gap-y-1.5">
                <Field label="PAN No.">
                  <input
                    className={inputClass}
                    value={draft.pan}
                    onChange={(e) => patch({ pan: e.target.value })}
                  />
                </Field>
                <Field label="GSTIN">
                  <input
                    className={inputClass}
                    value={draft.gstin}
                    onChange={(e) => patch({ gstin: e.target.value })}
                  />
                </Field>
                <Field label="Composite No.">
                  <input
                    className={inputClass}
                    value={draft.compositeNo}
                    onChange={(e) => patch({ compositeNo: e.target.value })}
                  />
                </Field>
                <Field label="Registration Date">
                  <input
                    className={inputClass}
                    type="date"
                    value={draft.registrationDate}
                    onChange={(e) => patch({ registrationDate: e.target.value })}
                  />
                </Field>
              </div>
            </FieldGroup>

            <FieldGroup label="Status">
              <div className="grid grid-cols-4 gap-x-2 gap-y-1.5">
                <Field label="Master Type">
                  <p className="py-1.5 text-[12.5px] font-semibold">
                    {isSales ? "SALES" : "PURCHASE_AGENT"}
                  </p>
                </Field>
                <Field label="Black Listed">
                  <label className="flex items-center gap-2 py-1.5 text-[12.5px]">
                    <input
                      type="checkbox"
                      checked={draft.blackListed}
                      onChange={(e) => patch({ blackListed: e.target.checked })}
                    />
                    Mark as black listed
                  </label>
                </Field>
              </div>
            </FieldGroup>

            <div className="sticky bottom-0 flex justify-end gap-1.5 border-t border-(--line) bg-(--panel) px-4 py-2.5 -mx-4">
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
                onClick={() => void saveAgent()}
              >
                {mode === "create" ? "Save Agent" : "Update Agent"}
              </button>
            </div>
          </div>
        </Overlay>
      ) : null}
    </div>
  );
}

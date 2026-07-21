"use client";

import { useMemo, useState } from "react";
import { intakeGoodsReturn } from "@/server/actions/returns";
import { Field, buttonClass, inputClass } from "@/components/ui";

export type GrBillOption = {
  id: string;
  billNo: string;
  partyName: string;
  lines: {
    id: string;
    lotNumber: string | null;
    fabricName: string | null;
    colorFamily: string | null;
    shadeName: string | null;
    millName: string | null;
    millId: string | null;
    weaverName: string | null;
    finishName: string | null;
    width: string | null;
    gsm: string | null;
    quantity: string;
    unit: string;
    lotId: string | null;
  }[];
};

export type GrMarkaOption = {
  id: string;
  millId: string;
  code: string;
  label: string | null;
};

export function GoodsReturnIntakeForm({
  bills,
  markas,
}: {
  bills: GrBillOption[];
  markas: GrMarkaOption[];
}) {
  const [billId, setBillId] = useState("");
  const [lineId, setLineId] = useState("");
  const bill = useMemo(
    () => bills.find((b) => b.id === billId) ?? null,
    [bills, billId],
  );
  const line = bill?.lines.find((item) => item.id === lineId) ?? null;
  const millMarkas = line?.millId
    ? markas.filter((marka) => marka.millId === line.millId)
    : [];

  return (
    <form action={intakeGoodsReturn} className="space-y-1.5">
      <Field label="Sale bill">
        <select
          className={inputClass}
          name="saleBillId"
          required
          value={billId}
          onChange={(e) => {
            setBillId(e.target.value);
            setLineId("");
          }}
        >
          <option value="">Select bill…</option>
          {bills.map((b) => (
            <option key={b.id} value={b.id}>
              {b.billNo} · {b.partyName}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Goods line on bill">
        <select
          className={inputClass}
          name="saleBillLineId"
          required
          disabled={!bill}
          value={lineId}
          onChange={(event) => setLineId(event.target.value)}
        >
          <option value="">
            {bill ? "Select line…" : "Pick a bill first"}
          </option>
          {(bill?.lines ?? []).map((l) => (
            <option key={l.id} value={l.id}>
              {[
                l.lotNumber,
                l.fabricName,
                l.colorFamily && l.shadeName
                  ? `${l.colorFamily}/${l.shadeName}`
                  : l.shadeName,
                l.millName ? `mill ${l.millName}` : null,
                `${l.quantity}${l.unit}`,
              ]
                .filter(Boolean)
                .join(" · ")}
            </option>
          ))}
        </select>
      </Field>

      {line ? (
        <div className="rounded border border-(--line) bg-[#fafbfc] p-1.5 text-[11px]">
          <p className="font-semibold">
            {line.fabricName ?? "Fabric"} ·{" "}
            {[line.colorFamily, line.shadeName].filter(Boolean).join("/") || "—"}
          </p>
          <p className="mt-0.5 text-(--muted)">
            Mill {line.millName ?? "not linked"} · Weaver{" "}
            {line.weaverName ?? "—"} · Finish {line.finishName ?? "—"} · W{" "}
            {line.width ?? "—"} · GSM {line.gsm ?? "—"}
          </p>
        </div>
      ) : null}

      <Field label="Verified mill marka">
        <select
          className={inputClass}
          name="millMarkaId"
          required
          disabled={!line?.millId || millMarkas.length === 0}
          defaultValue=""
          key={lineId}
        >
          <option value="">
            {!line
              ? "Pick goods first"
              : !line.millId
                ? "Goods have no connected mill"
                : millMarkas.length === 0
                  ? "No marka registered for this mill"
                  : "Select physical marka…"}
          </option>
          {millMarkas.map((marka) => (
            <option key={marka.id} value={marka.id}>
              {marka.code}
              {marka.label ? ` · ${marka.label}` : ""}
            </option>
          ))}
        </select>
      </Field>
      {line?.millId && millMarkas.length === 0 ? (
        <p className="rounded border border-(--danger) bg-(--danger-soft) px-2 py-1 text-[10px] text-(--danger)">
          No verified marka for this mill. Do not accept the return. Add the
          marka under Masters → Mills first.
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-1.5">
        <Field label="Return qty (m)">
          <input
            className={inputClass}
            name="quantity"
            type="number"
            step="any"
            required
          />
        </Field>
        <Field label="Priority">
          <select className={inputClass} name="priority" defaultValue="MEDIUM">
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
          </select>
        </Field>
      </div>

      <Field label="Roll lengths (optional)">
        <input
          className={inputClass}
          name="rollLengths"
          placeholder="45, 48  or  R1:45, R2:48"
        />
      </Field>

      <Field label="Original lot no (if sticker found)">
        <input
          className={inputClass}
          name="originalLotRef"
          placeholder="Optional — MCLOT-… / old tag"
        />
      </Field>

      <Field label="Customer reason / note">
        <input className={inputClass} name="reason" />
      </Field>

      <p className="text-[10px] text-(--muted)">
        Creates MCSR lot pending GR QC. Stock enters return inventory only after
        checklist QC.
      </p>

      <button
        className={buttonClass}
        type="submit"
        disabled={!line || millMarkas.length === 0}
      >
        Intake goods return
      </button>
    </form>
  );
}

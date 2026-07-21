import { formatDec } from "@/server/domain/goods";
import { formatQty } from "@/lib/utils";

export type GoodsRow = {
  lotNumber?: string | null;
  fabricName?: string | null;
  colorFamily?: string | null;
  shadeName?: string | null;
  shadeCode?: string | null;
  finishName?: string | null;
  millName?: string | null;
  weaverName?: string | null;
  width?: { toString(): string } | number | string | null;
  gsm?: { toString(): string } | number | string | null;
  marka?: string | null;
  rollCount?: number | null;
  weightKg?: { toString(): string } | number | string | null;
  lengthM?: { toString(): string } | number | string | null;
  rollsDetail?: string | null;
  quantity?: { toString(): string } | number | string | null;
  unit?: string | null;
  rate?: { toString(): string } | number | string | null;
  amount?: { toString(): string } | number | string | null;
};

export function GoodsTable({
  rows,
  showMoney = false,
}: {
  rows: GoodsRow[];
  showMoney?: boolean;
}) {
  if (rows.length === 0) {
    return (
      <p className="text-[11px] text-(--muted)">No goods lines.</p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="erp-table">
        <thead>
          <tr>
            <th>Lot</th>
            <th>Fabric</th>
            <th>Color</th>
            <th>Finish</th>
            <th>W / GSM</th>
            <th>Rolls</th>
            <th>Len / Wt</th>
            <th>Mill</th>
            <th>Weaver</th>
            {showMoney ? (
              <>
                <th>Qty</th>
                <th>Rate</th>
                <th>Amt</th>
              </>
            ) : (
              <th>Qty</th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const color = [r.colorFamily, r.shadeName]
              .filter(Boolean)
              .join(" / ");
            const shadeCode = r.shadeCode ? ` (${r.shadeCode})` : "";
            return (
              <tr key={`${r.lotNumber ?? "line"}-${i}`}>
                <td>
                  <div className="font-semibold">{r.lotNumber ?? "—"}</div>
                  {r.marka ? (
                    <div className="text-[10px] text-(--muted)">Mk {r.marka}</div>
                  ) : null}
                </td>
                <td>{r.fabricName ?? "—"}</td>
                <td>
                  {color || "—"}
                  {shadeCode}
                </td>
                <td>{r.finishName ?? "—"}</td>
                <td className="tabular-nums">
                  {formatDec(r.width)} / {formatDec(r.gsm)}
                </td>
                <td>
                  <div className="tabular-nums">{r.rollCount ?? "—"}</div>
                  {r.rollsDetail ? (
                    <div className="max-w-40 truncate text-[10px] text-(--muted)">
                      {r.rollsDetail}
                    </div>
                  ) : null}
                </td>
                <td className="tabular-nums">
                  {formatDec(r.lengthM ?? r.quantity)}
                  {r.unit ? ` ${r.unit}` : ""}
                  {r.weightKg != null && String(r.weightKg) !== ""
                    ? ` / ${formatDec(r.weightKg)}kg`
                    : ""}
                </td>
                <td>{r.millName ?? "—"}</td>
                <td>{r.weaverName ?? "—"}</td>
                {showMoney ? (
                  <>
                    <td className="tabular-nums">
                      {formatQty(r.quantity ?? 0)} {r.unit ?? ""}
                    </td>
                    <td className="tabular-nums">₹{formatQty(r.rate ?? 0)}</td>
                    <td className="font-semibold tabular-nums">
                      ₹{formatQty(r.amount ?? 0)}
                    </td>
                  </>
                ) : (
                  <td className="tabular-nums">
                    {formatQty(r.quantity ?? 0)} {r.unit ?? ""}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

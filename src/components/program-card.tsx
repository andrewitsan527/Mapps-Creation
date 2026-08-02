import type { ReactNode } from "react";
import { COMPANY } from "@/lib/company";
import type { ProgramCardData } from "@/server/domain/program-card";

function fmtDate(d: Date | null | undefined) {
  if (!d) return "—";
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function contrastInk(hex: string | null | undefined) {
  if (!hex || !/^#[0-9a-fA-F]{6}$/.test(hex)) return "#ffffff";
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luma = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luma > 0.62 ? "#1a1208" : "#ffffff";
}

function Spec({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="pc-spec">
      <span className="pc-spec-label">{label}</span>
      <span className="pc-spec-value">{value || "—"}</span>
    </div>
  );
}

/**
 * Print-ready Mapps Creation program / swatch card.
 * Matches the physical letterhead: gold on charcoal, GSTIN, address,
 * and a large visual colour chip so the mill sees the intended shade.
 */
export function ProgramCard({ data }: { data: ProgramCardData }) {
  const c = data.company ?? COMPANY;
  const hex = data.shade.hex || "#808080";
  const ink = contrastInk(data.shade.hex);
  const primaryInFamily = data.familyShades.find((s) => s.id === data.shade.id);
  const strip = primaryInFamily
    ? data.familyShades
    : [data.shade, ...data.familyShades];

  return (
    <article className="program-card-print pc-sheet">
      {/* Top meta strip */}
      <div className="pc-topbar">
        <span>GSTIN: {c.gstin}</span>
        <span className="pc-badge">PROGRAM CARD</span>
        <span className="pc-wa">
          <svg
            viewBox="0 0 24 24"
            width="12"
            height="12"
            fill="currentColor"
            aria-hidden
          >
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
            <path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.988-1.407A9.958 9.958 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm0 18a8 8 0 01-4.084-1.117l-.292-.174-2.958.835.81-2.883-.19-.304A7.96 7.96 0 014 12a8 8 0 1116 0 8 8 0 01-8 8z" />
          </svg>
          {c.phone}
        </span>
      </div>

      {/* Brand header */}
      <header className="pc-header">
        <div className="pc-brand-row">
          <div className="pc-mono" aria-hidden>
            {c.monogram}
          </div>
          <div className="pc-brand-text">
            <h1>{c.name}</h1>
            <p className="pc-tagline">{c.tagline}</p>
          </div>
        </div>
        <p className="pc-address">{c.address}</p>
      </header>

      {/* Specs */}
      <section className="pc-specs">
        <Spec label="Program no." value={data.programNo} />
        <Spec label="Date" value={fmtDate(data.sentAt ?? data.createdAt)} />
        <Spec label="Fabric" value={data.fabricType.name} />
        <Spec label="Mill" value={data.mill.name} />
        <Spec
          label="Weaver"
          value={data.weaver?.name ?? "—"}
        />
        <Spec
          label="Finish"
          value={data.finishType?.name ?? "—"}
        />
        <Spec
          label="Width"
          value={data.width ? `${data.width}"` : "—"}
        />
        <Spec
          label="G.S.M."
          value={data.gsm ? `${data.gsm} gsm` : "—"}
        />
        <Spec
          label="Grey PO"
          value={data.greyOrder?.poNumber ?? "—"}
        />
        <Spec
          label="Lot no."
          value={
            data.lots.length > 0
              ? data.lots.map((l) => l.lotNumber).join(", ")
              : "—"
          }
        />
      </section>

      {/* Colour + process */}
      <section className="pc-body">
        <div className="pc-colour-col">
          <p className="pc-section-label">Colour for mill</p>
          <div
            className="pc-swatch-hero"
            style={{ background: hex, color: ink }}
          >
            <span className="pc-swatch-name">{data.shade.name}</span>
            <span className="pc-swatch-meta">
              {data.shade.colorFamily.name} · {data.shade.code}
            </span>
            <span className="pc-swatch-hex">{hex.toUpperCase()}</span>
          </div>

          {strip.length > 1 ? (
            <div className="pc-family">
              <p className="pc-section-label">
                {data.shade.colorFamily.name} family
              </p>
              <ul className="pc-family-list">
                {strip.map((s, i) => {
                  const isPrimary = s.id === data.shade.id;
                  return (
                    <li
                      key={s.id}
                      className={
                        isPrimary ? "pc-family-item is-primary" : "pc-family-item"
                      }
                    >
                      <span
                        className="pc-family-chip"
                        style={{ background: s.hex || "#ccc" }}
                      />
                      <span className="pc-family-text">
                        <strong>
                          {i + 1}. {s.name}
                        </strong>
                        <em>{(s.hex || "no hex").toUpperCase()}</em>
                      </span>
                      {isPrimary ? (
                        <span className="pc-family-flag">THIS</span>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
        </div>

        <div className="pc-notes-col">
          <p className="pc-section-label">Process instructions</p>
          <div className="pc-notes">
            {data.finishType ? (
              <p>
                <strong>Finish</strong>
                {data.finishType.name}
              </p>
            ) : null}
            {data.feelFallNotes ? (
              <p>
                <strong>Feel / fall</strong>
                {data.feelFallNotes}
              </p>
            ) : null}
            {data.extraMods ? (
              <p>
                <strong>Extra process</strong>
                {data.extraMods}
              </p>
            ) : null}
            {data.remarks ? (
              <p>
                <strong>Remarks</strong>
                {data.remarks}
              </p>
            ) : null}
            {!data.finishType &&
            !data.feelFallNotes &&
            !data.extraMods &&
            !data.remarks ? (
              <p className="pc-notes-empty">Standard process as discussed.</p>
            ) : null}
          </div>

          <div className="pc-signoff">
            <p>Programme card</p>
            <span className="pc-check" aria-hidden>
              ✓
            </span>
          </div>
        </div>

        <div className="pc-watermark" aria-hidden>
          {c.monogram}
        </div>
      </section>

      <footer className="pc-footer">
        <span>
          {c.shortName} · {data.programNo}
        </span>
        <span>Print / PDF for mill · colour chip is authoritative</span>
      </footer>
    </article>
  );
}

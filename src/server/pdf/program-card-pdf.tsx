import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
import { COMPANY } from "@/lib/company";
import type { ProgramCardData } from "@/server/domain/program-card";

const styles = StyleSheet.create({
  page: {
    padding: 28,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: "#1a1208",
  },
  header: {
    backgroundColor: "#14110e",
    padding: 14,
    marginBottom: 12,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 6,
  },
  mono: {
    width: 28,
    height: 28,
    borderWidth: 1,
    borderColor: "#c9a227",
    borderRadius: 14,
    color: "#e8c547",
    fontSize: 9,
    textAlign: "center",
    paddingTop: 7,
    fontFamily: "Helvetica-Bold",
  },
  brand: {
    color: "#e8c547",
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 1,
  },
  tagline: {
    color: "#ffffff",
    fontSize: 7,
    letterSpacing: 1.5,
    marginTop: 2,
    opacity: 0.75,
  },
  meta: {
    color: "#f3e7c8",
    fontSize: 7.5,
    marginTop: 6,
  },
  badge: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "#c9a227",
    color: "#f5e6b8",
    fontSize: 7,
    letterSpacing: 1.2,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginBottom: 6,
    fontFamily: "Helvetica-Bold",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    borderWidth: 1,
    borderColor: "#e5d8bc",
    marginBottom: 12,
  },
  cell: {
    width: "50%",
    padding: 7,
    borderBottomWidth: 1,
    borderBottomColor: "#efe6d4",
    borderRightWidth: 1,
    borderRightColor: "#efe6d4",
  },
  label: {
    fontSize: 7,
    color: "#8a7a5c",
    letterSpacing: 0.8,
    fontFamily: "Helvetica-Bold",
    marginBottom: 2,
    textTransform: "uppercase",
  },
  value: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
  },
  swatchBox: {
    padding: 14,
    marginBottom: 10,
    borderRadius: 4,
  },
  swatchName: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    marginBottom: 2,
  },
  swatchMeta: {
    fontSize: 9,
    marginBottom: 4,
  },
  notes: {
    borderWidth: 1,
    borderColor: "#d6c7a8",
    borderStyle: "dashed",
    padding: 10,
    marginBottom: 10,
  },
  footer: {
    marginTop: 8,
    fontSize: 7,
    color: "#8a7a5c",
  },
});

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.cell}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value || "—"}</Text>
    </View>
  );
}

function ProgramCardPdfDoc({ data }: { data: ProgramCardData }) {
  const c = data.company ?? COMPANY;
  const hex = data.shade.hex || "#808080";
  const date = (data.sentAt ?? data.createdAt).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return (
    <Document
      title={`${data.programNo} — Program card`}
      author={c.shortName}
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.badge}>PROGRAM CARD</Text>
          <View style={styles.brandRow}>
            <Text style={styles.mono}>{c.monogram}</Text>
            <View>
              <Text style={styles.brand}>{c.name}</Text>
              <Text style={styles.tagline}>{c.tagline}</Text>
            </View>
          </View>
          <Text style={styles.meta}>
            GSTIN: {c.gstin} · WhatsApp: {c.phone}
          </Text>
          <Text style={styles.meta}>{c.address}</Text>
        </View>

        <View style={styles.grid}>
          <Spec label="Program no." value={data.programNo} />
          <Spec label="Date" value={date} />
          <Spec label="Fabric" value={data.fabricType.name} />
          <Spec label="Mill" value={data.mill.name} />
          <Spec label="Weaver" value={data.weaver?.name ?? "—"} />
          <Spec label="Finish" value={data.finishType?.name ?? "—"} />
          <Spec label="Width" value={data.width ? `${data.width}"` : "—"} />
          <Spec label="G.S.M." value={data.gsm ? `${data.gsm} gsm` : "—"} />
          <Spec label="Grey PO" value={data.greyOrder?.poNumber ?? "—"} />
          <Spec
            label="Lot no."
            value={
              data.lots.length
                ? data.lots.map((l) => l.lotNumber).join(", ")
                : "—"
            }
          />
        </View>

        <View style={[styles.swatchBox, { backgroundColor: hex }]}>
          <Text
            style={[
              styles.swatchName,
              { color: isLight(hex) ? "#1a1208" : "#ffffff" },
            ]}
          >
            {data.shade.name}
          </Text>
          <Text
            style={[
              styles.swatchMeta,
              { color: isLight(hex) ? "#1a1208" : "#ffffff" },
            ]}
          >
            {data.shade.colorFamily.name} · {data.shade.code} ·{" "}
            {hex.toUpperCase()}
          </Text>
        </View>

        <View style={styles.notes}>
          <Text style={styles.label}>Process instructions</Text>
          <Text>
            {[
              data.finishType ? `Finish: ${data.finishType.name}` : null,
              data.feelFallNotes ? `Feel / fall: ${data.feelFallNotes}` : null,
              data.extraMods ? `Extra: ${data.extraMods}` : null,
              data.remarks ? `Remarks: ${data.remarks}` : null,
            ]
              .filter(Boolean)
              .join("\n") || "Standard process as discussed."}
          </Text>
        </View>

        <Text style={styles.footer}>
          {c.shortName} · {data.programNo} · Colour chip is authoritative
        </Text>
      </Page>
    </Document>
  );
}

function isLight(hex: string) {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return false;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.62;
}

export async function renderProgramCardPdf(data: ProgramCardData) {
  return renderToBuffer(
    React.createElement(ProgramCardPdfDoc, { data }) as never,
  );
}

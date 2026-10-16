import path from "node:path";
import React from "react";
import { Font, StyleSheet, Text, View } from "@react-pdf/renderer";
import { COMPANY } from "@/lib/company";

const FONT_DIR = path.join(process.cwd(), "src", "server", "pdf", "fonts");
const fontFile = (name: string) => path.join(FONT_DIR, name);

Font.register({
  family: "Plex",
  fonts: [
    { src: fontFile("IBMPlexSans-Regular.ttf"), fontWeight: 400 },
    { src: fontFile("IBMPlexSans-Medium.ttf"), fontWeight: 500 },
    { src: fontFile("IBMPlexSans-SemiBold.ttf"), fontWeight: 600 },
    { src: fontFile("IBMPlexSans-Bold.ttf"), fontWeight: 700 },
  ],
});
Font.register({
  family: "Playfair",
  fonts: [{ src: fontFile("PlayfairDisplay-Bold.ttf"), fontWeight: 700 }],
});
Font.registerHyphenationCallback((word) => [word]);

export const ink = {
  text: "#1d1b18",
  muted: "#6f6a60",
  faint: "#9a9488",
  rule: "#d8d2c4",
  ruleSoft: "#e9e4d8",
  gold: "#b38b2a",
  goldDark: "#8a6a1c",
  tint: "#f8f5ed",
  head: "#f1ebdd",
  zebra: "#fbf9f4",
};

const MARGIN_X = 36;

export const pdfStyles = StyleSheet.create({
  page: {
    paddingTop: 50,
    paddingBottom: 58,
    paddingHorizontal: MARGIN_X,
    fontFamily: "Plex",
    fontSize: 9,
    color: ink.text,
  },

  brand: {
    fontFamily: "Playfair",
    fontWeight: 700,
    fontSize: 25,
    letterSpacing: 3,
    textAlign: "center",
    lineHeight: 1.1,
  },
  tagline: {
    fontSize: 6.5,
    fontWeight: 600,
    letterSpacing: 3,
    color: ink.gold,
    textAlign: "center",
    marginTop: 6,
  },
  address: {
    fontSize: 8.5,
    color: ink.muted,
    textAlign: "center",
    marginTop: 6,
  },
  band: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
    paddingVertical: 4,
    borderTopWidth: 1.2,
    borderTopColor: ink.gold,
    borderBottomWidth: 0.6,
    borderBottomColor: ink.gold,
    fontSize: 8,
    color: ink.muted,
  },
  bandStrong: { color: ink.text, fontWeight: 600 },

  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginTop: 14,
    marginBottom: 12,
    paddingBottom: 6,
    borderBottomWidth: 0.8,
    borderBottomColor: ink.text,
  },
  title: { fontSize: 15, fontWeight: 600, letterSpacing: 2, lineHeight: 1.2 },
  subtitle: { fontSize: 8, color: ink.muted, marginTop: 2 },
  metaLine: { flexDirection: "row", justifyContent: "flex-end", fontSize: 8.5 },
  metaLabel: { color: ink.muted, width: 34, textAlign: "right", marginRight: 6 },
  metaValue: { fontWeight: 600, minWidth: 70, textAlign: "right" },

  continuation: {
    position: "absolute",
    top: 20,
    left: MARGIN_X,
    right: MARGIN_X,
  },
  continuationRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingBottom: 4,
    borderBottomWidth: 0.6,
    borderBottomColor: ink.gold,
  },
  continuationBrand: { fontFamily: "Playfair", fontWeight: 700, fontSize: 10, letterSpacing: 1.5 },
  continuationDoc: { fontSize: 8, color: ink.muted },

  footer: {
    position: "absolute",
    left: MARGIN_X,
    right: MARGIN_X,
    bottom: 24,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 5,
    borderTopWidth: 0.6,
    borderTopColor: ink.rule,
    fontSize: 7,
    color: ink.faint,
  },

  cardRow: { flexDirection: "row", marginBottom: 12 },
  card: { borderWidth: 0.8, borderColor: ink.rule },
  cardHead: {
    backgroundColor: ink.tint,
    borderBottomWidth: 0.8,
    borderBottomColor: ink.rule,
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    fontSize: 7,
    fontWeight: 600,
    letterSpacing: 1.2,
    color: ink.goldDark,
  },
  cardBody: { paddingHorizontal: 8, paddingVertical: 6 },
  partyName: { fontSize: 11, fontWeight: 600, marginBottom: 2 },
  partyLine: { fontSize: 8.5, color: ink.muted },
  kvRow: { flexDirection: "row", paddingVertical: 1.5 },
  kvLabel: { width: "42%", fontSize: 8.5, color: ink.muted },
  kvValue: { width: "58%", fontSize: 9, fontWeight: 500 },

  sectionTitle: {
    fontSize: 8,
    fontWeight: 600,
    letterSpacing: 1.4,
    color: ink.text,
    marginBottom: 5,
  },
  sectionCount: { color: ink.muted, fontWeight: 400, letterSpacing: 0 },

  table: { marginBottom: 12 },
  tr: { flexDirection: "row" },
  th: {
    backgroundColor: ink.head,
    borderTopWidth: 1,
    borderTopColor: ink.text,
    borderBottomWidth: 0.8,
    borderBottomColor: ink.text,
    paddingHorizontal: 6,
    paddingVertical: 4,
    fontSize: 7.5,
    fontWeight: 600,
    letterSpacing: 0.6,
  },
  td: {
    borderBottomWidth: 0.5,
    borderBottomColor: ink.ruleSoft,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  tdTotal: {
    backgroundColor: ink.head,
    borderBottomWidth: 1,
    borderBottomColor: ink.text,
    paddingHorizontal: 6,
    paddingVertical: 4.5,
    fontWeight: 600,
  },
  num: { textAlign: "right" },
  zebra: { backgroundColor: ink.zebra },

  notes: {
    borderLeftWidth: 2,
    borderLeftColor: ink.gold,
    backgroundColor: ink.tint,
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginBottom: 12,
  },
  notesLabel: { fontSize: 7, fontWeight: 600, letterSpacing: 1.2, color: ink.goldDark, marginBottom: 2 },

  note: { fontSize: 8.5, color: ink.muted, marginTop: 4 },
  signRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 30 },
  signBox: { width: "38%" },
  signFor: { fontSize: 8.5, fontWeight: 600, textAlign: "right" },
  signSpace: { height: 34 },
  signLine: { borderTopWidth: 0.8, borderTopColor: ink.text, paddingTop: 3, fontSize: 8, color: ink.muted },
});

const s = pdfStyles;

export function Letterhead() {
  const c = COMPANY;
  return (
    <View>
      <Text style={s.brand}>{c.name}</Text>
      <Text style={s.tagline}>{c.tagline}</Text>
      <Text style={s.address}>{c.address}</Text>
      <View style={s.band}>
        <Text>
          GSTIN <Text style={s.bandStrong}>{c.gstin}</Text>
        </Text>
        <Text>
          WhatsApp <Text style={s.bandStrong}>+91 {c.phone}</Text>
        </Text>
      </View>
    </View>
  );
}

export function DocTitle({
  title,
  subtitle,
  docNo,
  date,
}: {
  title: string;
  subtitle: string;
  docNo: string;
  date: string;
}) {
  return (
    <View style={s.titleRow}>
      <View>
        <Text style={s.title}>{title}</Text>
        <Text style={s.subtitle}>{subtitle}</Text>
      </View>
      <View>
        <View style={s.metaLine}>
          <Text style={s.metaLabel}>No.</Text>
          <Text style={s.metaValue}>{docNo}</Text>
        </View>
        <View style={s.metaLine}>
          <Text style={s.metaLabel}>Date</Text>
          <Text style={s.metaValue}>{date}</Text>
        </View>
      </View>
    </View>
  );
}

/** Slim header on page 2 onwards, so a loose page still names its document. */
export function ContinuationHeader({ title, docNo }: { title: string; docNo: string }) {
  return (
    <View
      fixed
      style={s.continuation}
      render={({ pageNumber }) =>
        pageNumber > 1 ? (
          <View style={s.continuationRow}>
            <Text style={s.continuationBrand}>{COMPANY.name}</Text>
            <Text style={s.continuationDoc}>
              {title} · No. {docNo} · continued
            </Text>
          </View>
        ) : null
      }
    />
  );
}

export function Footer({ title, docNo }: { title: string; docNo: string }) {
  return (
    <View style={s.footer} fixed>
      <Text>{`${COMPANY.shortName} · ${title} ${docNo}`}</Text>
      <Text>Computer generated document</Text>
      <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
    </View>
  );
}

export function Card({
  heading,
  width,
  style,
  children,
}: {
  heading: string;
  width: string;
  style?: { marginLeft?: number | string };
  children: React.ReactNode;
}) {
  return (
    <View style={[s.card, { width }, style ?? {}]}>
      <Text style={s.cardHead}>{heading.toUpperCase()}</Text>
      <View style={s.cardBody}>{children}</View>
    </View>
  );
}

export function KeyValues({ rows }: { rows: { label: string; value: string }[] }) {
  return (
    <>
      {rows.map((row) => (
        <View key={row.label} style={s.kvRow}>
          <Text style={s.kvLabel}>{row.label}</Text>
          <Text style={s.kvValue}>{row.value || "—"}</Text>
        </View>
      ))}
    </>
  );
}

/** Full-width card with its label/value rows split over two columns. */
export function DetailCard({
  heading,
  rows,
}: {
  heading: string;
  rows: { label: string; value: string }[];
}) {
  const half = Math.ceil(rows.length / 2);
  return (
    <View style={{ marginBottom: 12 }} wrap={false}>
      <Card heading={heading} width="100%">
        <View style={{ flexDirection: "row" }}>
          <View style={{ width: "50%", paddingRight: 10 }}>
            <KeyValues rows={rows.slice(0, half)} />
          </View>
          <View style={{ width: "50%", paddingLeft: 10, borderLeftWidth: 0.5, borderLeftColor: ink.ruleSoft }}>
            <KeyValues rows={rows.slice(half)} />
          </View>
        </View>
      </Card>
    </View>
  );
}

export type PdfMill = { name: string; address: string; city: string; mobile: string };

export function MillCard({ mill, width }: { mill: PdfMill; width: string }) {
  const place = [mill.address, mill.city].filter(Boolean).join(", ");
  return (
    <Card heading="To (mill)" width={width}>
      <Text style={s.partyName}>{mill.name || "—"}</Text>
      {place ? <Text style={s.partyLine}>{place}</Text> : null}
      <Text style={s.partyLine}>Mobile: {mill.mobile || "—"}</Text>
    </Card>
  );
}

export function SectionTitle({ title, count }: { title: string; count?: string }) {
  return (
    <Text style={s.sectionTitle} minPresenceAhead={40}>
      {title.toUpperCase()}
      {count ? <Text style={s.sectionCount}>{`   ${count}`}</Text> : null}
    </Text>
  );
}

export function SignOff({ note, left }: { note: string; left: string }) {
  return (
    <View wrap={false}>
      <Text style={s.note}>{note}</Text>
      <View style={s.signRow}>
        <View style={s.signBox}>
          <View style={s.signSpace} />
          <Text style={s.signLine}>{left}</Text>
        </View>
        <View style={s.signBox}>
          <Text style={s.signFor}>For {COMPANY.name}</Text>
          <View style={{ height: 22 }} />
          <Text style={[s.signLine, { textAlign: "right" }]}>Authorised signatory</Text>
        </View>
      </View>
    </View>
  );
}

export function pdfDate(date: Date | null | undefined) {
  if (!date) return "—";
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function pdfDateTime(date: Date) {
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });
}

export function pdfKg(value: number) {
  return value.toLocaleString("en-IN", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
}

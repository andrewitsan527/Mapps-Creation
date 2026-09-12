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

export type GreyPoPdfData = {
  id: string;
  poNumber: string;
  orderDate: Date;
  quantity: string | null;
  unit: string;
  fabricNotes: string | null;
  whatsappNote: string | null;
  status: string;
  supplier: {
    name: string;
    whatsapp: string | null;
    phone: string | null;
    gstin: string | null;
    address: string | null;
  };
  bills: Array<{
    billNo: string;
    amount: string;
    notes: string | null;
  }>;
};

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
  block: {
    borderWidth: 1,
    borderColor: "#d6c7a8",
    padding: 10,
    marginBottom: 10,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#faf6ee",
    borderBottomWidth: 1,
    borderBottomColor: "#e5d8bc",
    paddingVertical: 5,
    paddingHorizontal: 6,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#efe6d4",
    paddingVertical: 5,
    paddingHorizontal: 6,
  },
  colBill: { width: "30%" },
  colAmt: { width: "25%", textAlign: "right" },
  colNotes: { width: "45%" },
  footer: {
    marginTop: 10,
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

function GreyPoPdfDoc({ data }: { data: GreyPoPdfData }) {
  const c = COMPANY;
  const date = data.orderDate.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return (
    <Document title={`${data.poNumber} — Grey PO`} author={c.shortName}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.badge}>GREY PURCHASE ORDER</Text>
          <Text style={styles.brand}>{c.name}</Text>
          <Text style={styles.tagline}>{c.tagline}</Text>
          <Text style={styles.meta}>
            GSTIN: {c.gstin} · WhatsApp: {c.phone}
          </Text>
          <Text style={styles.meta}>{c.address}</Text>
        </View>

        <View style={styles.grid}>
          <Spec label="PO number" value={data.poNumber} />
          <Spec label="Date" value={date} />
          <Spec label="Supplier" value={data.supplier.name} />
          <Spec label="Status" value={data.status} />
          <Spec
            label="Quantity"
            value={
              data.quantity ? `${data.quantity} ${data.unit}` : `— ${data.unit}`
            }
          />
          <Spec
            label="Supplier GSTIN"
            value={data.supplier.gstin?.toUpperCase() ?? "—"}
          />
          <Spec
            label="Supplier WhatsApp"
            value={data.supplier.whatsapp ?? data.supplier.phone ?? "—"}
          />
          <Spec label="Supplier address" value={data.supplier.address ?? "—"} />
        </View>

        <View style={styles.block}>
          <Text style={styles.label}>Fabric / order notes</Text>
          <Text>{data.fabricNotes || "—"}</Text>
          {data.whatsappNote ? (
            <Text style={{ marginTop: 6 }}>
              WhatsApp note: {data.whatsappNote}
            </Text>
          ) : null}
        </View>

        {data.bills.length > 0 ? (
          <View style={styles.block}>
            <Text style={[styles.label, { marginBottom: 6 }]}>
              Supplier bills
            </Text>
            <View style={styles.tableHeader}>
              <Text style={[styles.colBill, styles.label]}>Bill no.</Text>
              <Text style={[styles.colAmt, styles.label]}>Amount</Text>
              <Text style={[styles.colNotes, styles.label]}>Notes</Text>
            </View>
            {data.bills.map((b) => (
              <View key={b.billNo} style={styles.tableRow}>
                <Text style={styles.colBill}>{b.billNo}</Text>
                <Text style={styles.colAmt}>₹{b.amount}</Text>
                <Text style={styles.colNotes}>{b.notes || "—"}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <Text style={styles.footer}>
          {c.shortName} · {data.poNumber} · Please confirm receipt of this PO
        </Text>
      </Page>
    </Document>
  );
}

export async function renderGreyPoPdf(data: GreyPoPdfData) {
  return renderToBuffer(React.createElement(GreyPoPdfDoc, { data }) as never);
}

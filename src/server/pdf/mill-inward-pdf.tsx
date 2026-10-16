import React from "react";
import { Document, Page, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { COMPANY } from "@/lib/company";
import {
  Card,
  ContinuationHeader,
  DetailCard,
  DocTitle,
  Footer,
  KeyValues,
  Letterhead,
  MillCard,
  SectionTitle,
  SignOff,
  ink,
  pdfDate,
  pdfDateTime,
  pdfKg,
  pdfStyles as s,
  type PdfMill,
} from "./letterhead";

export type MillInwardPdfData = {
  srNo: string;
  inwardDate: Date;
  dateOfIssue: Date | null;
  sentAt: Date;
  sourceType: "GREY_PURCHASE" | "MANUAL";
  mill: PdfMill;
  knitterName: string;
  challanNo: string;
  billNo: string;
  agent: string;
  items: { name: string; rolls: number; qtyKg: number }[];
  rollWeights: number[];
  totalRolls: number;
  totalKg: number;
  remarks: string;
};

const TITLE = "MILL INWARD";
const ROLLS_PER_ROW = 6;
const NO_WIDTH = 6;
const KG_WIDTH = 100 / ROLLS_PER_ROW - NO_WIDTH;

function rollRows(weights: number[]) {
  const rows: { index: number; weight: number }[][] = [];
  weights.forEach((weight, index) => {
    (rows[Math.floor(index / ROLLS_PER_ROW)] ??= []).push({ index, weight });
  });
  return rows;
}

function RollTable({ weights }: { weights: number[] }) {
  const columns = Array.from({ length: ROLLS_PER_ROW }, (_, col) => col);
  const divider = (col: number) =>
    col > 0 ? { borderLeftWidth: 0.8, borderLeftColor: ink.rule } : {};
  return (
    <View style={s.table}>
      <View style={s.tr} fixed>
        {columns.map((col) => (
          <React.Fragment key={col}>
            <Text style={[s.th, divider(col), { width: `${NO_WIDTH}%`, paddingLeft: 6, paddingRight: 2 }]}>
              NO.
            </Text>
            <Text style={[s.th, s.num, { width: `${KG_WIDTH}%` }]}>KG</Text>
          </React.Fragment>
        ))}
      </View>
      {rollRows(weights).map((row, rowIndex) => (
        <View key={rowIndex} style={[s.tr, rowIndex % 2 ? s.zebra : {}]} wrap={false}>
          {columns.map((col) => {
            const roll = row[col];
            return (
              <React.Fragment key={col}>
                <Text
                  style={[
                    s.td,
                    divider(col),
                    { width: `${NO_WIDTH}%`, paddingLeft: 6, paddingRight: 2, color: ink.muted, fontSize: 8 },
                  ]}
                >
                  {roll ? roll.index + 1 : ""}
                </Text>
                <Text style={[s.td, s.num, { width: `${KG_WIDTH}%`, fontWeight: 500 }]}>
                  {roll ? pdfKg(roll.weight) : ""}
                </Text>
              </React.Fragment>
            );
          })}
        </View>
      ))}
    </View>
  );
}

function MillInwardPdfDoc({ data }: { data: MillInwardPdfData }) {
  const grey = data.sourceType === "GREY_PURCHASE";
  const itemRolls = data.items.reduce((sum, item) => sum + item.rolls, 0) || data.totalRolls;
  const itemKg = data.items.reduce((sum, item) => sum + item.qtyKg, 0) || data.totalKg;
  const rollKg = data.rollWeights.reduce((sum, weight) => sum + weight, 0);

  return (
    <Document title={`${data.srNo} — Mill Inward`} author={COMPANY.shortName}>
      <Page size="A4" style={s.page}>
        <ContinuationHeader title={TITLE} docNo={data.srNo} />
        <Letterhead />
        <DocTitle
          title={TITLE}
          subtitle="Grey delivered to your mill for Mapps Creation"
          docNo={data.srNo}
          date={pdfDate(data.inwardDate)}
        />

        <View style={s.cardRow}>
          <MillCard mill={data.mill} width="54%" />
          <Card heading="Inward details" width="44%" style={{ marginLeft: "2%" }}>
            <KeyValues
              rows={[
                { label: "Inward No.", value: data.srNo },
                { label: "Inward date", value: pdfDate(data.inwardDate) },
                { label: "Date of issue", value: pdfDate(data.dateOfIssue) },
                { label: "Source", value: grey ? "Grey purchase" : "Own grey" },
                { label: "Sent on", value: pdfDateTime(data.sentAt) },
              ]}
            />
          </Card>
        </View>

        <DetailCard
          heading="Grey details"
          rows={[
            { label: "Knitter", value: data.knitterName },
            { label: "Agent", value: data.agent },
            { label: "Knitter challan no.", value: data.challanNo },
            { label: "Knitter bill no.", value: data.billNo },
          ]}
        />

        <SectionTitle title="Items" />
        <View style={s.table}>
          <View style={s.tr}>
            <Text style={[s.th, { width: "8%" }]}>SNO.</Text>
            <Text style={[s.th, { width: "56%" }]}>ITEM</Text>
            <Text style={[s.th, s.num, { width: "16%" }]}>ROLLS</Text>
            <Text style={[s.th, s.num, { width: "20%" }]}>QTY (KG)</Text>
          </View>
          {data.items.map((item, index) => (
            <View key={index} style={[s.tr, index % 2 ? s.zebra : {}]} wrap={false}>
              <Text style={[s.td, { width: "8%" }]}>{index + 1}</Text>
              <Text style={[s.td, { width: "56%", fontWeight: 500 }]}>{item.name || "—"}</Text>
              <Text style={[s.td, s.num, { width: "16%" }]}>{item.rolls || "—"}</Text>
              <Text style={[s.td, s.num, { width: "20%" }]}>
                {item.qtyKg ? pdfKg(item.qtyKg) : "—"}
              </Text>
            </View>
          ))}
          <View style={s.tr} wrap={false}>
            <Text style={[s.tdTotal, { width: "64%" }]}>Total</Text>
            <Text style={[s.tdTotal, s.num, { width: "16%" }]}>{itemRolls}</Text>
            <Text style={[s.tdTotal, s.num, { width: "20%" }]}>{pdfKg(itemKg)}</Text>
          </View>
        </View>

        {data.rollWeights.length > 0 ? (
          <>
            <SectionTitle
              title="Roll weights"
              count={`${data.rollWeights.length} rolls · ${pdfKg(rollKg)} KG`}
            />
            <RollTable weights={data.rollWeights} />
          </>
        ) : null}

        {data.remarks ? (
          <View style={s.notes} wrap={false}>
            <Text style={s.notesLabel}>REMARKS</Text>
            <Text>{data.remarks}</Text>
          </View>
        ) : null}

        <SignOff
          note={`Total ${data.totalRolls} rolls · ${pdfKg(data.totalKg)} KG. Please check the rolls on arrival and confirm receipt.`}
          left="Received by (mill) · sign & stamp"
        />

        <Footer title="Mill Inward" docNo={data.srNo} />
      </Page>
    </Document>
  );
}

export async function renderMillInwardPdf(data: MillInwardPdfData) {
  return renderToBuffer(<MillInwardPdfDoc data={data} />);
}

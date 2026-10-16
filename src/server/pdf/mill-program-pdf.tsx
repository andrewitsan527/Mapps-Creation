import React from "react";
import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
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
  pdfStyles as s,
  type PdfMill,
} from "./letterhead";

export type MillProgramPdfData = {
  srNo: string;
  programDate: Date;
  sentAt: Date;
  mill: PdfMill;
  inwardSrNo: string;
  dateOfIssue: Date | null;
  knitterName: string;
  challanNo: string;
  itemLabel: string;
  inwardRolls: number;
  typeOfFinish: string;
  gsm: string;
  width: string;
  lines: { rolls: number; colour: string }[];
};

const TITLE = "MILL PROGRAM";

const p = StyleSheet.create({
  panel: {
    flexDirection: "row",
    borderWidth: 0.8,
    borderColor: ink.gold,
    backgroundColor: ink.tint,
    marginBottom: 12,
  },
  panelCell: {
    flexGrow: 1,
    flexBasis: 0,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRightWidth: 0.6,
    borderRightColor: ink.rule,
  },
  panelLabel: { fontSize: 7, fontWeight: 600, letterSpacing: 1, color: ink.goldDark },
  panelValue: { fontSize: 13, fontWeight: 600, marginTop: 2 },
});

function MillProgramPdfDoc({ data }: { data: MillProgramPdfData }) {
  const programmed = data.lines.reduce((sum, line) => sum + line.rolls, 0);
  const process = [
    { label: "Type of finish", value: data.typeOfFinish },
    { label: "GSM", value: data.gsm },
    { label: "Width", value: data.width },
    { label: "Rolls to process", value: String(programmed) },
  ];

  return (
    <Document title={`${data.srNo} — Mill Program`} author={COMPANY.shortName}>
      <Page size="A4" style={s.page}>
        <ContinuationHeader title={TITLE} docNo={data.srNo} />
        <Letterhead />
        <DocTitle
          title={TITLE}
          subtitle="Processing instructions for our grey at your mill"
          docNo={data.srNo}
          date={pdfDate(data.programDate)}
        />

        <View style={s.cardRow}>
          <MillCard mill={data.mill} width="54%" />
          <Card heading="Program details" width="44%" style={{ marginLeft: "2%" }}>
            <KeyValues
              rows={[
                { label: "Program No.", value: data.srNo },
                { label: "Program date", value: pdfDate(data.programDate) },
                { label: "Mill inward No.", value: data.inwardSrNo },
                { label: "Sent on", value: pdfDateTime(data.sentAt) },
              ]}
            />
          </Card>
        </View>

        <SectionTitle title="Process instructions" />
        <View style={p.panel} wrap={false}>
          {process.map((cell, index) => (
            <View
              key={cell.label}
              style={[p.panelCell, index === process.length - 1 ? { borderRightWidth: 0 } : {}]}
            >
              <Text style={p.panelLabel}>{cell.label.toUpperCase()}</Text>
              <Text style={p.panelValue}>{cell.value || "—"}</Text>
            </View>
          ))}
        </View>

        <DetailCard
          heading="Grey source"
          rows={[
            { label: "Item", value: data.itemLabel },
            { label: "Knitter", value: data.knitterName },
            { label: "Knitter challan no.", value: data.challanNo },
            { label: "Date of issue", value: pdfDate(data.dateOfIssue) },
            { label: "Rolls in inward", value: String(data.inwardRolls) },
            { label: "Rolls in this program", value: String(programmed) },
          ]}
        />

        <SectionTitle title="Program" count={`${data.lines.length} colours · ${programmed} rolls`} />
        <View style={s.table}>
          <View style={s.tr} fixed>
            <Text style={[s.th, { width: "12%" }]}>SNO.</Text>
            <Text style={[s.th, s.num, { width: "22%" }]}>NO. OF ROLLS</Text>
            <Text style={[s.th, { width: "66%", paddingLeft: 18 }]}>COLOUR</Text>
          </View>
          {data.lines.map((line, index) => (
            <View key={index} style={[s.tr, index % 2 ? s.zebra : {}]} wrap={false}>
              <Text style={[s.td, { width: "12%" }]}>{index + 1}</Text>
              <Text style={[s.td, s.num, { width: "22%", fontWeight: 600 }]}>{line.rolls}</Text>
              <Text style={[s.td, { width: "66%", paddingLeft: 18, fontWeight: 500 }]}>
                {line.colour || "—"}
              </Text>
            </View>
          ))}
          <View style={s.tr} wrap={false}>
            <Text style={[s.tdTotal, { width: "12%" }]}>Total</Text>
            <Text style={[s.tdTotal, s.num, { width: "22%" }]}>{programmed}</Text>
            <Text style={[s.tdTotal, { width: "66%" }]}> </Text>
          </View>
        </View>

        <SignOff
          note={`Please process ${programmed} rolls of ${data.itemLabel || "our grey"} as per this program and confirm.`}
          left="Accepted by (mill) · sign & stamp"
        />

        <Footer title="Mill Program" docNo={data.srNo} />
      </Page>
    </Document>
  );
}

export async function renderMillProgramPdf(data: MillProgramPdfData) {
  return renderToBuffer(<MillProgramPdfDoc data={data} />);
}

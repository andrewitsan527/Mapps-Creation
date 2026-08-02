import { notFound } from "next/navigation";
import { ProgramCard } from "@/components/program-card";
import { ProgramCardToolbar } from "@/components/program-card-toolbar";
import { getProgramCardData } from "@/server/domain/program-card";
import { sendProgramWhatsApp } from "@/server/actions/programs";

export default async function ProgramCardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getProgramCardData(id);
  if (!data) notFound();

  const canWhatsApp =
    Boolean(data.mill.whatsapp) &&
    (data.status === "DRAFT" || data.status === "SENT_TO_MILL");

  return (
    <div className="mx-auto max-w-[820px]">
      <ProgramCardToolbar
        programId={data.id}
        programNo={data.programNo}
        canWhatsApp={canWhatsApp}
        whatsappAction={sendProgramWhatsApp}
      />
      <ProgramCard data={data} />
      <p className="no-print mt-3 text-center text-[11px] text-(--muted)">
        Use <strong>Print</strong> for a paper copy, or <strong>Save PDF</strong>{" "}
        and pick “Save as PDF” in the system print dialog. The colour chip
        prints with the shade hex so the mill can match it.
      </p>
    </div>
  );
}

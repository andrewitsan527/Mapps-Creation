import { notFound } from "next/navigation";
import { ProgramCard } from "@/components/program-card";
import { PublicCardActions } from "@/components/public-card-actions";
import { getProgramCardData } from "@/server/domain/program-card";
import { COMPANY } from "@/lib/company";

/**
 * Public mill-facing program card (no ERP chrome, no login).
 * Linked from WhatsApp so the mill can open, print, or save as PDF.
 */
export default async function PublicProgramCardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getProgramCardData(id);
  if (!data) notFound();

  return (
    <div className="min-h-screen bg-[#ebe4d6] px-3 py-4 sm:px-6 sm:py-6">
      <div className="no-print mx-auto mb-3 max-w-[820px]">
        <p className="font-serif text-[18px] font-semibold tracking-tight text-[#1a1208]">
          {COMPANY.shortName}
        </p>
        <p className="text-[11px] text-[#8a7a5c]">
          Program card · {data.programNo} · colour chip matches shade hex
        </p>
      </div>
      <div className="mx-auto max-w-[820px]">
        <ProgramCard data={data} />
      </div>
      <PublicCardActions />
    </div>
  );
}

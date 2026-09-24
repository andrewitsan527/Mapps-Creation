import { prisma } from "@/lib/db";
import { COMPANY } from "@/lib/company";

export type ProgramCardData = {
  id: string;
  programNo: string;
  status: string;
  createdAt: Date;
  sentAt: Date | null;
  width: string | null;
  gsm: string | null;
  feelFallNotes: string | null;
  extraMods: string | null;
  remarks: string | null;
  mill: {
    id: string;
    name: string;
    whatsapp: string | null;
    phone: string | null;
  };
  weaver: { id: string; name: string } | null;
  fabricType: { id: string; name: string };
  quality: { id: string; name: string } | null;
  code: { id: string; name: string } | null;
  colour: { id: string; name: string } | null;
  finishType: { id: string; name: string } | null;
  greyOrder: { poNumber: string } | null;
  lots: { id: string; lotNumber: string }[];
  company: typeof COMPANY;
};

export async function getProgramCardData(
  id: string,
): Promise<ProgramCardData | null> {
  const program = await prisma.millProgram.findUnique({
    where: { id },
    include: {
      mill: {
        select: { id: true, name: true, whatsapp: true, phone: true },
      },
      weaver: { select: { id: true, name: true } },
      fabricType: { select: { id: true, name: true } },
      quality: { select: { id: true, name: true } },
      code: { select: { id: true, name: true } },
      colour: { select: { id: true, name: true } },
      finishType: { select: { id: true, name: true } },
      greyOrder: { select: { poNumber: true } },
      lots: {
        select: { id: true, lotNumber: true },
        orderBy: { createdAt: "desc" },
        take: 5,
      },
    },
  });

  if (!program) return null;

  return {
    id: program.id,
    programNo: program.programNo,
    status: program.status,
    createdAt: program.createdAt,
    sentAt: program.sentAt,
    width: program.width?.toString() ?? null,
    gsm: program.gsm?.toString() ?? null,
    feelFallNotes: program.feelFallNotes,
    extraMods: program.extraMods,
    remarks: program.remarks,
    mill: program.mill,
    weaver: program.weaver,
    fabricType: program.fabricType,
    quality: program.quality,
    code: program.code,
    colour: program.colour,
    finishType: program.finishType,
    greyOrder: program.greyOrder,
    lots: program.lots,
    company: COMPANY,
  };
}

export function programCardPublicUrl(programId: string, baseUrl?: string) {
  const base =
    baseUrl ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/p/${programId}`;
}

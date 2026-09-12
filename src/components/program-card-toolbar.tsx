"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Download,
  Eye,
  MessageCircle,
  Printer,
} from "lucide-react";
import { buttonClass, buttonGhostClass, buttonWaClass } from "@/components/ui";
import { WhatsAppForm } from "@/components/whatsapp-form";

export function ProgramCardToolbar({
  programId,
  programNo,
  canWhatsApp,
  whatsappAction,
}: {
  programId: string;
  programNo: string;
  canWhatsApp: boolean;
  whatsappAction?: (
    formData: FormData,
  ) => Promise<{ shareUrl?: string; pdfUrl?: string } | void>;
}) {
  const router = useRouter();

  return (
    <div className="no-print mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-(--line) bg-(--panel) px-3 py-2 shadow-(--shadow-sm)">
      <div className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          onClick={() => router.push("/programs")}
          className={buttonGhostClass}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Programs
        </button>
        <span className="hidden h-4 w-px bg-(--line) sm:block" />
        <div className="min-w-0">
          <p className="truncate text-[12px] font-semibold text-(--ink)">
            {programNo}
          </p>
          <p className="flex items-center gap-1 text-[10.5px] text-(--muted)">
            <Eye className="h-3 w-3" />
            Live preview · print or download PDF
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          className={buttonClass}
          onClick={() => window.print()}
        >
          <Printer className="h-3.5 w-3.5" />
          Print
        </button>
        <a
          href={`/api/pdf/program/${programId}`}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonGhostClass}
          title="Download program card PDF"
        >
          <Download className="h-3.5 w-3.5" />
          PDF
        </a>
        {canWhatsApp && whatsappAction ? (
          <WhatsAppForm action={whatsappAction}>
            <input type="hidden" name="id" value={programId} />
            <button className={buttonWaClass} type="submit">
              <MessageCircle className="h-3 w-3" />
              WhatsApp mill
            </button>
          </WhatsAppForm>
        ) : null}
        <Link href={`/programs/${programId}/card`} className="sr-only">
          Card
        </Link>
      </div>
    </div>
  );
}

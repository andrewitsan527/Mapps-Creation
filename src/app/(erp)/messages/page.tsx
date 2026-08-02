import { MessageCircle, Radio } from "lucide-react";
import { prisma } from "@/lib/db";
import { statusBadge } from "@/lib/format";
import { formatDateTime } from "@/lib/utils";
import { getWhatsAppProviderName } from "@/server/whatsapp";
import {
  EmptyState,
  Metric,
  MetricStrip,
  PageHeader,
  Panel,
  TableWrap,
} from "@/components/ui";

export default async function MessagesPage() {
  const provider = getWhatsAppProviderName();
  const [logs, sent, failed, stubbed] = await Promise.all([
    prisma.whatsAppMessageLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.whatsAppMessageLog.count({ where: { status: "SENT" } }),
    prisma.whatsAppMessageLog.count({ where: { status: "FAILED" } }),
    prisma.whatsAppMessageLog.count({ where: { status: "STUB" } }),
  ]);

  const live = provider === "meta";

  return (
    <div className="space-y-3">
      <PageHeader
        title="WhatsApp log"
        eyebrow="Insight"
        icon={MessageCircle}
        description="Every outbound message the ERP sends — mill programs, sale bills on delivery, mill RF notices, and payment reminders."
      />

      <MetricStrip className="grid-cols-2 sm:grid-cols-4">
        <Metric
          label="Provider"
          value={live ? "Meta Cloud" : "Stub"}
          tone={live ? "wa" : "warn"}
          hint={live ? "Live sends" : "Set WHATSAPP_PROVIDER=meta"}
        />
        <Metric label="Sent" value={sent} tone="accent" />
        <Metric
          label="Failed"
          value={failed}
          tone={failed ? "danger" : "neutral"}
        />
        <Metric label="Stub logs" value={stubbed} hint="Not delivered" />
      </MetricStrip>

      <Panel
        title="Message log"
        icon={live ? Radio : MessageCircle}
        tone={live ? "wa" : "neutral"}
        subtitle={`Last ${logs.length}`}
        flush
      >
        {logs.length === 0 ? (
          <div className="p-2.5">
            <EmptyState
              icon={MessageCircle}
              text="No messages yet. Send a program, delivery bill, mill RF or payment reminder."
            />
          </div>
        ) : (
          <TableWrap maxHeight={600}>
            <table className="erp-table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>To</th>
                  <th>Template</th>
                  <th>Entity</th>
                  <th>Status</th>
                  <th>Detail</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((m) => {
                  const payload = m.payload as {
                    variables?: Record<string, string>;
                    provider?: string;
                  } | null;
                  const preview =
                    payload?.variables?.body?.slice(0, 80) ||
                    m.error ||
                    payload?.provider ||
                    "—";
                  return (
                    <tr key={m.id}>
                      <td className="text-[11px] whitespace-nowrap text-(--muted)">
                        {formatDateTime(m.createdAt)}
                      </td>
                      <td className="font-medium">{m.to}</td>
                      <td className="text-[11px]">{m.template}</td>
                      <td className="text-[11px] text-(--muted)">
                        {m.entityType ?? "—"}
                        {m.entityId ? ` · ${m.entityId.slice(0, 8)}` : ""}
                      </td>
                      <td>
                        <span className={statusBadge(m.status)}>
                          {m.status}
                        </span>
                      </td>
                      <td className="max-w-64 truncate text-[11px] text-(--muted)">
                        {preview}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Panel>
    </div>
  );
}

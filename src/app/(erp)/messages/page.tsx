import { MessageCircle, Radio } from "lucide-react";
import { prisma } from "@/lib/db";
import { statusBadge } from "@/lib/format";
import { getWhatsAppProviderName } from "@/server/whatsapp";
import { EmptyState, PageHeader, Panel, StatCard } from "@/components/ui";

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

  return (
    <div>
      <PageHeader
        title="WhatsApp"
        icon={MessageCircle}
        description="Outbound mill, delivery, QC RF and payment reminders. Provider switches via WHATSAPP_PROVIDER."
      />

      <div className="mb-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        <StatCard
          label="Provider"
          value={provider === "meta" ? "Meta" : "Stub"}
          hint={
            provider === "meta"
              ? "Cloud API live"
              : "Set WHATSAPP_PROVIDER=meta + token"
          }
          icon={Radio}
        />
        <StatCard label="Sent" value={sent} icon={MessageCircle} />
        <StatCard label="Failed" value={failed} />
        <StatCard label="Stub logs" value={stubbed} />
      </div>

      <Panel title="Message log" icon={MessageCircle} compact>
        {logs.length === 0 ? (
          <EmptyState
            icon={MessageCircle}
            text="No messages yet. Send a program, delivery bill, mill RF or payment reminder."
          />
        ) : (
          <div className="overflow-x-auto">
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
                      <td className="whitespace-nowrap text-[11px]">
                        {m.createdAt.toLocaleString("en-IN")}
                      </td>
                      <td className="font-medium">{m.to}</td>
                      <td>{m.template}</td>
                      <td className="text-[11px] text-(--muted)">
                        {m.entityType ?? "—"}
                        {m.entityId ? ` · ${m.entityId.slice(0, 8)}` : ""}
                      </td>
                      <td>
                        <span className={statusBadge(m.status)}>{m.status}</span>
                      </td>
                      <td className="max-w-56 truncate text-[11px] text-(--muted)">
                        {preview}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

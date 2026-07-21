import { prisma } from "@/lib/db";
import { statusBadge } from "@/lib/format";
import { EmptyState, PageHeader, Panel } from "@/components/ui";

export default async function MessagesPage() {
  const logs = await prisma.whatsAppMessageLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 80,
  });

  return (
    <div>
      <PageHeader
        title="WhatsApp log"
        description="Outbound WhatsApp send log."
      />
      <Panel title="Message log" compact>
        {logs.length === 0 ? (
          <EmptyState text="No messages yet. Send a program or reminder to see logs." />
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
                </tr>
              </thead>
              <tbody>
                {logs.map((m) => (
                  <tr key={m.id}>
                    <td>{m.createdAt.toLocaleString("en-IN")}</td>
                    <td>{m.to}</td>
                    <td>{m.template}</td>
                    <td className="text-[11px] text-(--muted)">
                      {m.entityType ?? "—"} {m.entityId?.slice(0, 8) ?? ""}
                    </td>
                    <td>
                      <span className={statusBadge(m.status)}>{m.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

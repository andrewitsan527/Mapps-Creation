import { AgentMasterDesk } from "@/components/agent-master-desk";
import { listPurchaseAgents } from "@/server/actions/purchase-agents";

export default async function PurchaseAgentsPage() {
  const purchaseAgents = await listPurchaseAgents();
  return (
    <AgentMasterDesk kind="PURCHASE AGENT" purchaseAgents={purchaseAgents} />
  );
}

import { AgentMasterDesk } from "@/components/agent-master-desk";
import { listSalesAgents } from "@/server/actions/sales-agents";

export default async function SalesAgentsPage() {
  const salesAgents = await listSalesAgents();
  return <AgentMasterDesk kind="SALES AGENT" salesAgents={salesAgents} />;
}

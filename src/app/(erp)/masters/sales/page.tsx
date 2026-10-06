import { SalesMasterDesk } from "@/components/sales-master-desk";
import { listSalesAgents } from "@/server/actions/sales-agents";
import { listSalesMasters } from "@/server/actions/sales-masters";

export default async function SalesMasterPage() {
  const [salesMasters, salesAgents] = await Promise.all([
    listSalesMasters(),
    listSalesAgents(),
  ]);
  return (
    <SalesMasterDesk salesMasters={salesMasters} salesAgents={salesAgents} />
  );
}

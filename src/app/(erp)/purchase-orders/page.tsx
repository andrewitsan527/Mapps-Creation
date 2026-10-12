import { PurchaseOrderDesk } from "@/components/purchase-order-desk";
import { listKnitters } from "@/server/actions/knitters";
import { listPurchaseAgents } from "@/server/actions/purchase-agents";
import { listPurchaseOrders } from "@/server/actions/purchase-orders";

export default async function PurchaseOrdersPage() {
  const [orders, knitters, purchaseAgents] = await Promise.all([
    listPurchaseOrders(),
    listKnitters(),
    listPurchaseAgents(),
  ]);
  return (
    <PurchaseOrderDesk
      orders={orders}
      knitters={knitters}
      purchaseAgents={purchaseAgents}
    />
  );
}

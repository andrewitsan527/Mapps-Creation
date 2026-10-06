import { PurchaseOrderDesk } from "@/components/purchase-order-desk";
import { listKnitters } from "@/server/actions/knitters";
import { listPurchaseOrders } from "@/server/actions/purchase-orders";

export default async function PurchaseOrdersPage() {
  const [orders, knitters] = await Promise.all([
    listPurchaseOrders(),
    listKnitters(),
  ]);
  return <PurchaseOrderDesk orders={orders} knitters={knitters} />;
}

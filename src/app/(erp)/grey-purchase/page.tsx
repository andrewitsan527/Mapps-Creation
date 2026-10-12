import { GreyPurchaseDesk } from "@/components/grey-purchase-desk";
import { listGreyBills } from "@/server/actions/grey-bills";
import { listItems } from "@/server/actions/items";
import { listKnitters } from "@/server/actions/knitters";
import { listMills } from "@/server/actions/mills";
import { listPurchaseAgents } from "@/server/actions/purchase-agents";
import { listPurchaseOrders } from "@/server/actions/purchase-orders";

export default async function GreyPurchasePage() {
  const [bills, knitters, mills, items, purchaseOrders, purchaseAgents] =
    await Promise.all([
      listGreyBills(),
      listKnitters(),
      listMills(),
      listItems(),
      listPurchaseOrders(),
      listPurchaseAgents(),
    ]);
  return (
    <GreyPurchaseDesk
      bills={bills}
      knitters={knitters}
      mills={mills}
      items={items}
      purchaseOrders={purchaseOrders}
      purchaseAgents={purchaseAgents}
    />
  );
}

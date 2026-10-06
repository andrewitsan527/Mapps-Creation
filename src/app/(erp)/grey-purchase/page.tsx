import { FileText } from "lucide-react";
import { GreyPurchaseDesk } from "@/components/grey-purchase-desk";
import { PageHeader } from "@/components/ui";
import { listGreyBills } from "@/server/actions/grey-bills";
import { listItems } from "@/server/actions/items";
import { listKnitters } from "@/server/actions/knitters";
import { listMills } from "@/server/actions/mills";
import { listPurchaseOrders } from "@/server/actions/purchase-orders";

export default async function GreyPurchasePage() {
  const [bills, knitters, mills, items, purchaseOrders] = await Promise.all([
    listGreyBills(),
    listKnitters(),
    listMills(),
    listItems(),
    listPurchaseOrders(),
  ]);
  return (
    <div className="space-y-3">
      <PageHeader title="Grey Purchase" eyebrow="Procure" icon={FileText} />
      <GreyPurchaseDesk
        bills={bills}
        knitters={knitters}
        mills={mills}
        items={items}
        purchaseOrders={purchaseOrders}
      />
    </div>
  );
}

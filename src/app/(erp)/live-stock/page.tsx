import { LiveStockBoard } from "./live-stock-cards";
import { listLiveStock } from "@/server/actions/live-stock";

export default async function LiveStockPage() {
  const rolls = await listLiveStock();
  return (
    <div className="min-w-0">
      <LiveStockBoard rolls={rolls} />
    </div>
  );
}

import { Boxes } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/ui";
import { listLiveStock, type LiveStockSummary } from "@/server/actions/live-stock";
import { LiveStockCards } from "./live-stock-cards";

function rollLabel(count: number) {
  return `${count} ${count === 1 ? "Roll" : "Rolls"}`;
}

// TEMPORARY presentation preview. Remove this block after the client review.
// Shown only in local development when the database has no available rolls.
// These numbers are not saved and are never mixed with real stock.
const LIVE_STOCK_DEMO: LiveStockSummary | null =
  process.env.NODE_ENV === "development"
    ? {
        total: 247,
        colours: [
          { colour: "Green", rolls: 102 },
          { colour: "Blue", rolls: 45 },
          { colour: "Maroon", rolls: 28 },
          { colour: "Black", rolls: 67 },
          { colour: "Yellow", rolls: 5 },
        ],
      }
    : null;

export default async function LiveStockPage() {
  const real = await listLiveStock();
  const stock = real.colours.length === 0 && LIVE_STOCK_DEMO ? LIVE_STOCK_DEMO : real;

  return (
    <div className="tx-page">
      <div className="tx-stage space-y-3">
        <PageHeader title="Live Stock" eyebrow="Inventory" icon={Boxes} />
        <div className="rounded-lg border border-(--line) bg-(--panel) px-4 py-3">
          <p className="text-[10px] font-semibold tracking-wide text-(--muted) uppercase">
            Total Available Rolls
          </p>
          <p className="mt-1 text-[28px] leading-none font-semibold tabular-nums text-(--accent-strong)">
            {rollLabel(stock.total)}
          </p>
        </div>
        {stock.colours.length === 0 ? (
          <EmptyState icon={Boxes} text="No Live Stock Available" />
        ) : (
          <LiveStockCards colours={stock.colours} />
        )}
      </div>
    </div>
  );
}

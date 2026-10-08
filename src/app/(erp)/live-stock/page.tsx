import { LiveStockBoard } from "./live-stock-cards";

export default function LiveStockPage() {
  return (
    <div className="w-full bg-white text-neutral-900">
      <header className="mb-4">
        <h1 className="text-[22px] leading-tight font-semibold text-neutral-950">Live Stock</h1>
        <p className="mt-1 text-[13px] text-neutral-600">
          Fabric available to sell. Without QC rolls are included.
        </p>
      </header>
      <LiveStockBoard />
    </div>
  );
}

# Old ERP Workflow Retirement

Planning checklist only. This document does not disable, delete, or change any code.

The source of this checklist is the retirement audit of the lot/program workflow versus the roll-based workflow. Nothing in that audit is approved for deletion yet.

## 1. Objective

The old lot/program ERP is being retired. It tracked grey purchase orders, mill programs, mill receipts, lot inspection, lot stock, and sale bills as one chain.

The replacement is the roll-based workflow already in use:

Masters → Purchase Order → Grey Bill → New Mill Inward → Mill Program → Finished Work → Quality Check → Live Stock → Sales.

Old screens may stay reachable until each retirement batch is explicitly approved. New workflow files are not part of this retirement.

## 2. New Workflow — MUST KEEP

These routes, modules, and models stay. Do not disable or delete them as part of this process.

| Step | Route | Module | Models |
|---|---|---|---|
| Masters | `/masters/sales-agents`, `/masters/sales`, `/masters/knitters`, `/masters/process-mills`, `/masters/transport`, `/masters/jobs`, `/masters/hastes`, `/masters/items`, `/masters/purchase-agents` | `src/server/actions/sales-agents.ts`, `sales-masters.ts`, `knitters.ts`, `mills.ts`, `transports.ts`, `jobs.ts`, `hastes.ts`, `items.ts`, `purchase-agents.ts` | `SalesAgent`, `SalesMaster`, `Knitter`, `Mill`, `Transport`, `Haste`, `Job`, `Item`, `PurchaseAgent` |
| Purchase Order | `/purchase-orders` | `src/server/actions/purchase-orders.ts`, `src/components/purchase-order-desk.tsx` | `PurchaseOrder` |
| Grey Bill | `/grey-purchase` | `src/server/actions/grey-bills.ts`, `src/components/grey-purchase-desk.tsx` | `GreyBill`, `GreyBillItem`, `GreyBillRoll` |
| New Mill Inward | `/mill-inward` | `src/server/actions/mill-inward-entries.ts`, `src/components/mill-inward-desk.tsx` | `MillInwardEntry`, `MillInwardEntryItem`, `MillInwardEntryRoll`, `MillInwardEntryReturnLine` |
| Mill Program | `/mill-program` | `src/server/actions/mill-program-entries.ts`, `src/components/mill-program-desk.tsx` | `MillProgramEntry`, `MillProgramEntryLine` |
| Finished Work | `/finished-work` | `src/server/actions/finished-work-entries.ts`, `src/components/finished-work-desk.tsx` | `FinishedWorkEntry`, `FinishedWorkEntryLine`, `FinishedWorkEntryRoll` |
| Quality Check | `/quality-check` | `src/server/actions/quality-checks.ts`, `src/components/quality-check-desk.tsx` | `QualityCheckEntry`, `QualityCheckEntryLine` |
| Live Stock | `/live-stock` | `src/server/actions/live-stock.ts` | `LiveStockRoll` |
| Sales | `/sales` | `src/server/actions/sales-bills.ts`, `src/components/sales-desk.tsx` | `SalesBillEntry`, `SalesBillEntryLine`, `SalesBillEntryRoll` |

Finished Work and Quality Check have a known business-logic issue. That issue is out of scope for retirement. Both pages stay.

New Mill Inward is not the old `/inward` page. See section 3.

## 3. Old Workflow — RETIRE

The retired chain is:

Old Grey → Old Programs → OLD Mill Inward → Old QC → Old Lot Stock → Old SaleBill and its downstream screens (dispatch, payments, finance, returns, dashboard, reports, WhatsApp log).

Two Mill Inward systems exist. Only the old one is retired.

| | OLD — retire | NEW — keep |
|---|---|---|
| Route | `/inward` | `/mill-inward` |
| Action | `src/server/actions/inward.ts` | `src/server/actions/mill-inward-entries.ts` |
| UI | `src/components/mill-inward-form.tsx` | `src/components/mill-inward-desk.tsx` |
| Domain | `src/server/domain/mill-inward.ts` | none of that file; new code uses the entry actions |
| Model | `MillInward` (and `MillProgram`) | `MillInwardEntry` |

The same split exists for stock and QC:

| | OLD — retire | NEW — keep |
|---|---|---|
| QC | `/qc`, `src/server/actions/qc.ts`, model `QualityCheck` | `/quality-check`, `quality-checks.ts`, model `QualityCheckEntry` |
| Stock | `/stock`, `/stock/[lotId]`, `src/server/domain/stock.ts`, model `Lot` | `/live-stock`, `live-stock.ts`, model `LiveStockRoll` |
| Sales | `/sales/[billId]`, `src/server/actions/sales.ts`, model `SaleBill` | `/sales`, `sales-bills.ts`, model `SalesBillEntry` |
| Grey | `/grey`, `src/server/actions/grey.ts`, model `GreyPurchaseOrder` | `/purchase-orders` and `/grey-purchase`, models `PurchaseOrder` and `GreyBill` |

## 4. Old Routes

Every route below is still **ACTIVE**. Pages are still served. None is safe to delete yet.

Planned status is the next retirement step, not permission to delete.

| Route | File | Old purpose | Replacement / new direction | Current status | Planned |
|---|---|---|---|---|---|
| `/grey` | `src/app/(erp)/grey/page.tsx` | Raise old grey purchase orders and supplier bills | `/purchase-orders` and `/grey-purchase` | ACTIVE. Sidebar link already removed. Page still opens by URL. | TO DISABLE |
| `/programs` | `src/app/(erp)/programs/page.tsx` | Old mill program cards on `MillProgram` | `/mill-program` | ACTIVE. Sidebar link already removed. | TO DISABLE |
| `/programs/[id]/card` | `src/app/(erp)/programs/[id]/card/page.tsx` | Printable old program card | No new card yet. Retire with old programs. | ACTIVE | TO DISABLE |
| `/p/[id]` | `src/app/p/[id]/page.tsx` | Public mill-facing card linked from old WhatsApp | No new public card yet. Retire with old programs. | ACTIVE | TO DISABLE |
| `/inward` | `src/app/(erp)/inward/page.tsx` | Record a receipt against an old mill program | `/mill-inward` (`MillInwardEntry`) | ACTIVE. Sidebar link already removed. | TO DISABLE |
| `/qc` | `src/app/(erp)/qc/page.tsx` | Inspect old lots and move lot stock | `/quality-check` (`QualityCheckEntry`) | ACTIVE. Sidebar link already removed. Still linked from dashboard, returns, programs, and stock. | TO DISABLE |
| `/stock` | `src/app/(erp)/stock/page.tsx` | Lot availability. Nav label was "Live stock". | `/live-stock` (`LiveStockRoll`) | ACTIVE. Sidebar link already removed. Still linked from reports and old QC. | TO DISABLE |
| `/stock/[lotId]` | `src/app/(erp)/stock/[lotId]/page.tsx` | Lot history, including links into old grey and old sale bills | `/live-stock` | ACTIVE. Still linked from dashboard, returns, QC, and programs. | TO DISABLE |
| `/sales/[billId]` | `src/app/(erp)/sales/[billId]/page.tsx` | Detail and delivery of an old `SaleBill` | `/sales` (`SalesBillEntry`). Not a one-to-one screen yet. | ACTIVE. Still linked from dashboard, dispatch, payments, and finance. | TO DISABLE |
| `/dispatch` | `src/app/(erp)/dispatch/page.tsx` | Deliver old sale bills | Redesign around the new sales desk later. | ACTIVE. Still in the sidebar and pipeline rail. | TO REDESIGN |
| `/returns` | `src/app/(erp)/returns/page.tsx` | Goods return and mill RF on lots | Redesign around rolls later. | ACTIVE. Still in the sidebar and shell alerts. | TO REDESIGN |
| `/payments` | `src/app/(erp)/payments/page.tsx` | Receipts and dues on old sale bills | Redesign later. | ACTIVE. Still in the sidebar, menu, and pipeline rail. | TO REDESIGN |
| `/finance` | `src/app/(erp)/finance/page.tsx` | Account notes and commission on old sale bills | Redesign later. | ACTIVE. Still in the sidebar. | TO REDESIGN |
| `/dashboard` | `src/app/(erp)/dashboard/page.tsx` | Control tower for old lots, QC, returns, and sale bills | Redesign around the new workflow later. | ACTIVE. Still in the sidebar. Shell logo still links here. | TO REDESIGN |
| `/reports` | `src/app/(erp)/reports/page.tsx` | Snapshot of old programs, QC, lots, and sale bills | Redesign later. | ACTIVE. Still in the sidebar and main menu. | TO REDESIGN |
| `/messages` | `src/app/(erp)/messages/page.tsx` | Log of old program and mill-RF WhatsApp sends | Redesign later if a new message log is needed. | ACTIVE. Still in the sidebar and shell header. | TO REDESIGN |

`/menu` is not an old workflow route. It stays. It currently also links to old Payments and Reports.

## 5. Old Server Actions

Used only by the old pages and old components. The new desks do not import them.

| File | Role | Current status | Planned |
|---|---|---|---|
| `src/server/actions/grey.ts` | `createGreyPo`, `addGreyBill` on `GreyPurchaseOrder` / `GreyPurchaseBill` | ACTIVE | TO DISABLE, then DELETE LATER |
| `src/server/actions/programs.ts` | `createProgram`, `completeMillReturn`, `sendProgramWhatsApp` on `MillProgram` | ACTIVE | TO DISABLE, then DELETE LATER |
| `src/server/actions/inward.ts` | `createMillInward` on `MillInward` | ACTIVE | TO DISABLE, then DELETE LATER |
| `src/server/actions/qc.ts` | `submitQc` on old `QualityCheck` and `Lot` | ACTIVE | TO DISABLE, then DELETE LATER |
| `src/server/actions/sales.ts` | Old `SaleBill` create, convert, and `deliverSaleBill`. This is not `sales-bills.ts`. | ACTIVE | TO DISABLE, then DELETE LATER |
| `src/server/actions/returns.ts` | Goods return and mill RF | ACTIVE | TO REDESIGN, then DELETE LATER |
| `src/server/actions/payments.ts` | Receipts against old sale bills. Also called by `src/app/api/cron/payment-reminders/route.ts`. | ACTIVE | TO REDESIGN, then DELETE LATER |
| `src/server/actions/finance.ts` | Account notes and commission | ACTIVE | TO REDESIGN, then DELETE LATER |

Do not confuse `inward.ts` with `mill-inward-entries.ts`, `qc.ts` with `quality-checks.ts`, or `sales.ts` with `sales-bills.ts`.

## 6. Old Components

Imported only by the old routes. Not safe to delete yet.

| File | Used by | Current status | Planned |
|---|---|---|---|
| `src/components/mill-inward-form.tsx` | `/inward` only | ACTIVE | TO DISABLE, then DELETE LATER |
| `src/components/mill-return-complete-form.tsx` | `/inward`, `/programs` | ACTIVE | TO DISABLE, then DELETE LATER |
| `src/components/program-card.tsx` | `/programs/[id]/card`, `/p/[id]` | ACTIVE | TO DISABLE, then DELETE LATER |
| `src/components/program-card-toolbar.tsx` | `/programs/[id]/card` | ACTIVE | TO DISABLE, then DELETE LATER |
| `src/components/public-card-actions.tsx` | `/p/[id]` | ACTIVE | TO DISABLE, then DELETE LATER |
| `src/components/defect-checklist.tsx` | `/qc`, `/returns` | ACTIVE | TO DISABLE, then DELETE LATER |
| `src/components/goods-table.tsx` | `/sales/[billId]`, `/dispatch` | ACTIVE | TO DISABLE, then DELETE LATER |
| `src/components/goods-return-intake.tsx` | `/returns` | ACTIVE | TO REDESIGN, then DELETE LATER |
| `src/components/payment-entry-form.tsx` | `/payments` | ACTIVE | TO REDESIGN, then DELETE LATER |
| `src/components/flow-rail.tsx` | `/dashboard` | ACTIVE | TO REDESIGN, then DELETE LATER |
| `src/components/whatsapp-notify-toggle.tsx` | `/grey`, `/sales/[billId]`, `/dispatch` | ACTIVE | TO DISABLE, then DELETE LATER |

`src/components/mill-inward-desk.tsx` is the new desk. Do not disable it.

## 7. Old Domain / Utility Files

### Old-only

No new desk, master action, or live-stock action imports these. They are still **ACTIVE** because old pages call them. Planned: TO DISABLE with their callers, then DELETE LATER. Not safe to delete yet.

| File | Why it is old-only |
|---|---|
| `src/server/domain/mill-inward.ts` | Quantities and pending QC for old `MillInward` / `MillProgram` |
| `src/server/domain/mill-return.ts` | Opens and updates old `MillReturn` rows |
| `src/server/domain/program-card.ts` | Data for the old public program card |
| `src/server/domain/stock.ts` | Lot availability and `StockMovement`. Not `LiveStockRoll`. |
| `src/server/domain/goods.ts` | Old bill-line and lot roll display |
| `src/server/domain/finance.ts` | Commission and note math for old payments |
| `src/server/domain/receivables.ts` | Outstanding old `SaleBill` rows |
| `src/lib/doc-numbers.ts` | `nextProgramLotNo`, `nextMcsrLotNo`, `nextMillRfNo` |
| `src/lib/company.ts` | Company name on the old program card only |
| `src/lib/payment-labels.ts` | Labels for old payment categories |
| `src/lib/po-match.ts` | No importers. Still do not delete until an approved batch. |

### Shared — do not treat as old-only

| File | Why it stays for now |
|---|---|
| `src/server/domain/pipeline.ts` | Counts old lots, grey POs, and sale bills, but `src/app/(erp)/layout.tsx` loads it for every ERP page, including the new ones |
| `src/lib/local-workflow.ts` | New master desks use its types. New Quality Check uses `nextDatedSrNo` |
| `src/server/whatsapp/` | Old sends write logs through it, and the shell reads the provider name from it |
| `src/lib/flow.ts`, `src/lib/shell-flow.ts` | Navigation and shell types for the whole app |

## 8. Old Database Models

Do not edit `prisma/schema.prisma` or migrations as part of documentation. Models stay until a later, approved migration.

### DELETE LATER

These belong to the old chain. Application code still reads or writes them, so they are **RETAIN FOR NOW** until the readers in sections 4–7 are gone. After that, they are candidates for a migration. They are not safe to drop now.

| Model | Why it is old | Why it stays for now |
|---|---|---|
| `GreyPurchaseOrder` | Old `/grey` and `/programs` | `pipeline.ts` still counts it, and the layout loads that file |
| `GreyPurchaseBill` | Bills on old grey POs | `grey.ts` still creates rows |
| `MillProgram` | Old program cards | `programs.ts` and `inward.ts` still use it |
| `MillInward` | OLD mill inward. Not `MillInwardEntry`. | `/qc`, `inward.ts`, and `mill-return.ts` still load it |
| `Lot` | Old stock | Dashboard, stock, QC, returns, sales, and `pipeline.ts` |
| `LotRoll` | Rolls on a lot | Lot screens and old sales |
| `QualityCheck` | OLD inspection. Not `QualityCheckEntry`. | `/qc`, reports, and `User.qualityChecks` |
| `StockMovement` | Lot stock ledger | `domain/stock.ts` |
| `SaleBill` | OLD sale document. Not `SalesBillEntry`. | `/sales/[billId]`, dispatch, payments, finance, dashboard, `pipeline.ts` |
| `SaleBillLine` | Lines on `SaleBill` | Old sales and returns |
| `Dispatch` | Delivery of a `SaleBill` | `/dispatch`, `sales.ts` |
| `DispatchLine` | Dispatch lines | Lot detail and dispatch |
| `Payment` | Receipts against old bills | `/payments` |
| `AccountNote` | Finance notes | `/finance` |
| `CommissionEntry` | Commission on old bills | `/finance`, payments, receivables |
| `SalesReturn` | Old goods return | `/returns`, `pipeline.ts` |
| `MillReturn` | Mill RF from old QC | `/returns`, dashboard, `pipeline.ts` |
| `AuditTrail` | No references under `src` | Unused by the new workflow, but do not drop the table until an approved migration |
| `WhatsAppMessageLog` | History of old program and RF sends | `/messages` reads it. `src/server/whatsapp/index.ts` writes it, and the shell imports that module |

### Never drop with the old set

`User`, `Session`, Masters models, `PurchaseOrder`, `GreyBill`, `GreyBillItem`, `GreyBillRoll`, `MillInwardEntry` and its lines/rolls/return lines, `MillProgramEntry` and its lines, `FinishedWorkEntry` and its lines/rolls, `QualityCheckEntry` and its lines, `LiveStockRoll`, `SalesBillEntry` and its lines/rolls.

## 9. Shared / MUST KEEP

Do not disable or delete these while retiring the old workflow.

| File | Reason |
|---|---|
| `src/app/(erp)/layout.tsx` | Auth gate and shell for every ERP page. Loads `pipeline.ts`. |
| `src/components/erp-shell.tsx` | Sidebar chrome, alerts, logo |
| `src/components/erp-nav.tsx` | Sidebar, mobile bar, and More menu. Reads `flow.ts`. |
| `src/lib/flow.ts` | Nav clusters and the remaining pipeline rail |
| `src/lib/shell-flow.ts` | Shell badge types |
| `src/server/domain/pipeline.ts` | Required by the layout until that import is removed on purpose |
| `src/server/whatsapp/` | Provider name for the shell |
| `src/lib/local-workflow.ts` | Types for Masters and serial numbers for new Quality Check |
| `src/lib/auth.ts`, `src/lib/db.ts`, `src/components/ui.tsx` | Login, database client, shared UI |
| Master actions and desks | Current Masters |
| New modules in section 2 | Purchase Order through Sales |
| `src/app/(erp)/menu/page.tsx` | Home. Edit only its old links, in an approved nav batch |

## 10. Retirement Process

Statuses used in this checklist:

| Status | Meaning |
|---|---|
| ACTIVE | Still served or still imported. Default for everything in this file today. |
| TO DISABLE | Planned next step: remove links or stop calling it. Page or file may still exist. |
| TO REDESIGN | Downstream screen that should be replaced around the new workflow before it is removed. |
| DISABLED | Link removed or call path cut. File still in the repo. Not verified yet. |
| VERIFIED | After disable, the new workflow was checked and this item is unused by it. |
| DELETE LATER | Approved for a future deletion batch. Not deleted yet. |
| DO NOT TOUCH | New workflow, Masters, shell infrastructure, or a shared file that must stay. |

Sequence:

ACTIVE → DISABLED → VERIFIED → DELETE LATER

TO DISABLE and TO REDESIGN are planning labels. They are not DISABLED.

DO NOT TOUCH never enters that sequence.

A file moves to DELETE LATER only after VERIFIED, and only with an explicit approval to delete. This document does not grant that approval.

## 11. Batch Plan

Proposed order only. Do not implement these batches from this file.

### Batch 1: Old navigation and references

Remove remaining links to old routes from the sidebar, main menu, shell alerts, shell logo, and pipeline rail. Stop the layout from depending on old pipeline counts before any old file is deleted.

Still linked today:

- Sidebar and rail: `/dashboard`, `/returns`, `/dispatch`, `/payments`, `/finance`, `/reports`, `/messages`
- Main menu: `/payments`, `/reports`
- Shell: logo → `/dashboard`, header → `/messages`, alerts/badges → `/returns` and `/payments`
- In-page links from dashboard, returns, reports, programs, stock, QC, dispatch, payments, and finance into `/qc`, `/stock`, `/stock/[lotId]`, `/grey`, `/programs`, and `/sales/[billId]`

`/grey`, `/programs`, `/inward`, `/qc`, and `/stock` are already off the sidebar. Their pages are still ACTIVE.

### Batch 2: Old workflow routes, actions, and components

After Batch 1 is VERIFIED, disable then later delete the closed set:

- Routes in section 4 whose planned status is TO DISABLE
- Actions `grey.ts`, `programs.ts`, `inward.ts`, `qc.ts`, `sales.ts`
- Components in section 6 that those routes alone use

Keep `/sales`, `sales-bills.ts`, `/mill-inward`, and `mill-inward-entries.ts`.

### Batch 3: Old domain and utilities

After Batch 2 is VERIFIED, the old-only files in section 7 can move to DELETE LATER:

`domain/mill-inward.ts`, `domain/mill-return.ts`, `domain/program-card.ts`, `domain/stock.ts`, `domain/goods.ts`, `domain/finance.ts`, `domain/receivables.ts`, `lib/doc-numbers.ts`, `lib/company.ts`, `lib/payment-labels.ts`, `lib/po-match.ts`.

Leave `pipeline.ts` until the layout no longer imports it. Leave `local-workflow.ts` and `server/whatsapp/`.

### Batch 4: Downstream modules that need a redesign

`/dashboard`, `/returns`, `/reports`, `/dispatch`, `/payments`, `/finance`, `/messages`, plus `returns.ts`, `payments.ts`, `finance.ts`, the payment-reminder cron, `flow-rail.tsx`, `goods-return-intake.tsx`, and `payment-entry-form.tsx`.

Replace or empty these around the new roll workflow before they are deleted. Do not redesign them in the navigation or file-removal batches.

### Batch 5: Old Prisma models

Only after Batches 2–4 are VERIFIED. A future migration may drop the models in section 8. Do not drop new `*Entry` models, `GreyBill*`, `LiveStockRoll`, `PurchaseOrder`, or Masters. Do not edit the schema until that migration is explicitly approved.

## 12. Verification Checklist

Run this after each implementation batch. Do not run it as part of creating this document.

- [ ] Login works
- [ ] Masters open and save
- [ ] Purchase Order works (`/purchase-orders`)
- [ ] Grey Bill works (`/grey-purchase`)
- [ ] New Mill Inward works (`/mill-inward`, not `/inward`)
- [ ] Mill Program works (`/mill-program`)
- [ ] Finished Work works (`/finished-work`)
- [ ] Quality Check works (`/quality-check`, not `/qc`)
- [ ] Roll-based Live Stock works (`/live-stock`, not `/stock`)
- [ ] Sales works (`/sales`, `SalesBillEntry`)
- [ ] No new route returns 404
- [ ] No new workflow file imports `inward.ts`, `qc.ts`, `grey.ts`, `programs.ts`, `sales.ts`, `domain/stock.ts`, or `domain/mill-inward.ts`
- [ ] Build and typecheck pass

## 13. Emergency Recovery

Every implementation batch must:

- Stay small and limited to the files named in that batch
- Produce a clear diff
- Be verified with section 12 before the next batch starts
- Not modify new workflow files unless a shared import must be cut, and then only that import
- Not modify Finished Work, Quality Check, Live Stock, or Sales behavior
- Not delete files until that deletion is explicitly approved
- Not commit unless explicitly requested
- Not run migrations until Batch 5 is explicitly approved

If a batch fails verification, stop. Restore that batch’s diff before starting another. The new workflow remains the system of record throughout.

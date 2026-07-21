/** App roles — kept local so UI typing does not depend on Prisma enum re-exports. */
export type UserRole =
  | "OWNER"
  | "SALES"
  | "STORE"
  | "QC"
  | "ACCOUNTS"
  | "DISPATCH";

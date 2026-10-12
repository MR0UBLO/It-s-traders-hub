import { pgTable, serial, integer, numeric, text, timestamp } from "drizzle-orm/pg-core";

/**
 * A dedicated EA budget. The amount is reserved from the selected wallet when
 * the EA starts; EA stakes and payouts are managed inside this row until stop.
 */
export const eaBudgetsTable = pgTable("ea_budgets", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  accountType: text("account_type").notNull().default("real"),
  eaId: text("ea_id").notNull(),
  allocatedAmount: numeric("allocated_amount", { precision: 18, scale: 4 }).notNull(),
  balance: numeric("balance", { precision: 18, scale: 4 }).notNull(),
  maxTrades: integer("max_trades").notNull(),
  tradesOpened: integer("trades_opened").notNull().default(0),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

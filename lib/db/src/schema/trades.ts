import { pgTable, serial, integer, numeric, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const tradesTable = pgTable("trades", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  accountType: text("account_type").notNull().default("real"), // 'real' | 'demo'
  ticketNumber: text("ticket_number"),
  symbol: text("symbol").notNull(),
  direction: text("direction").notNull(), // 'buy' | 'sell'
  amount: numeric("amount", { precision: 18, scale: 4 }).notNull(),
  lotSize: numeric("lot_size", { precision: 18, scale: 4 }),
  marginUsed: numeric("margin_used", { precision: 18, scale: 4 }),
  entryPrice: numeric("entry_price", { precision: 18, scale: 6 }).notNull(),
  closePrice: numeric("close_price", { precision: 18, scale: 6 }),
  stopLoss: numeric("stop_loss", { precision: 18, scale: 6 }),
  takeProfit: numeric("take_profit", { precision: 18, scale: 6 }),
  profitLoss: numeric("profit_loss", { precision: 18, scale: 4 }),
  profitLossPercent: numeric("profit_loss_percent", { precision: 10, scale: 4 }),
  status: text("status").notNull().default("open"), // 'open' | 'closed'
  isCopied: boolean("is_copied").notNull().default(false),
  copiedFromUserId: integer("copied_from_user_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  closedAt: timestamp("closed_at", { withTimezone: true }),
});

export const insertTradeSchema = createInsertSchema(tradesTable).omit({ id: true, createdAt: true });
export type InsertTrade = z.infer<typeof insertTradeSchema>;
export type Trade = typeof tradesTable.$inferSelect;

import { pgTable, serial, integer, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const walletsTable = pgTable("wallets", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique(),
  balance: numeric("balance", { precision: 18, scale: 4 }).notNull().default("0"),
  totalDeposited: numeric("total_deposited", { precision: 18, scale: 4 }).notNull().default("0"),
  totalProfit: numeric("total_profit", { precision: 18, scale: 4 }).notNull().default("0"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const demoWalletsTable = pgTable("demo_wallets", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique(),
  balance: numeric("balance", { precision: 18, scale: 4 }).notNull().default("10000"),
  totalDeposited: numeric("total_deposited", { precision: 18, scale: 4 }).notNull().default("0"),
  totalProfit: numeric("total_profit", { precision: 18, scale: 4 }).notNull().default("0"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertWalletSchema = createInsertSchema(walletsTable).omit({ id: true, updatedAt: true });
export const insertDemoWalletSchema = createInsertSchema(demoWalletsTable).omit({ id: true, updatedAt: true });
export type InsertWallet = z.infer<typeof insertWalletSchema>;
export type InsertDemoWallet = z.infer<typeof insertDemoWalletSchema>;
export type Wallet = typeof walletsTable.$inferSelect;
export type DemoWallet = typeof demoWalletsTable.$inferSelect;

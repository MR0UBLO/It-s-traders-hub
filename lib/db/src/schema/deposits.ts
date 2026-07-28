import { pgTable, serial, integer, numeric, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const depositsTable = pgTable("deposits", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  accountType: text("account_type").notNull().default("real"), // 'real' | 'demo'
  amount: numeric("amount", { precision: 18, scale: 4 }).notNull(),
  status: text("status").notNull().default("pending"), // 'pending' | 'completed' | 'failed'
  phone: text("phone").notNull(),
  mpesaReceiptNumber: text("mpesa_receipt_number"),
  checkoutRequestId: text("checkout_request_id"),
  merchantRequestId: text("merchant_request_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export const insertDepositSchema = createInsertSchema(depositsTable).omit({ id: true, createdAt: true });
export type InsertDeposit = z.infer<typeof insertDepositSchema>;
export type Deposit = typeof depositsTable.$inferSelect;

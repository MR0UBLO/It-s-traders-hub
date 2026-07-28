import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";

export const signalsTable = pgTable("signals", {
  id: serial("id").primaryKey(),
  symbol: text("symbol").notNull(),
  direction: text("direction").notNull(),
  confidence: integer("confidence").notNull(),
  risk: text("risk").notNull(),
  timeframe: text("timeframe").notNull(),
  reason: text("reason").notNull(),
  entry: text("entry"),
  target: text("target"),
  stopLoss: text("stop_loss"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

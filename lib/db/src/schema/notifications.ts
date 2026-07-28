import { pgTable, serial, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";

export const notificationsTable = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  accountType: text("account_type").notNull().default("real"), // 'real' | 'demo'
  message: text("message").notNull(),
  type: text("type").notNull(),
  read: boolean("read").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

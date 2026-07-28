import { pgTable, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const followersTable = pgTable("followers", {
  id: serial("id").primaryKey(),
  followerId: integer("follower_id").notNull(),
  traderId: integer("trader_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertFollowerSchema = createInsertSchema(followersTable).omit({ id: true, createdAt: true });
export type InsertFollower = z.infer<typeof insertFollowerSchema>;
export type Follower = typeof followersTable.$inferSelect;

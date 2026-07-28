import { Router } from "express";
import { db, usersTable, walletsTable, tradesTable, followersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middlewares/auth.js";
import { logger } from "../lib/logger.js";

const router = Router();

async function buildTopTrader(user: { id: number; name: string }, currentUserId?: number) {
  const trades = await db.select().from(tradesTable).where(eq(tradesTable.userId, user.id));
  const wallet = await db.select().from(walletsTable).where(eq(walletsTable.userId, user.id)).limit(1);
  const followers = await db.select().from(followersTable).where(eq(followersTable.traderId, user.id));
  const closedTrades = trades.filter((t) => t.status === "closed");
  const wins = closedTrades.filter((t) => Number(t.profitLoss) > 0).length;
  const winRate = closedTrades.length > 0 ? (wins / closedTrades.length) * 100 : 0;

  let isFollowing = false;
  if (currentUserId) {
    const follow = await db.select().from(followersTable)
      .where(and(eq(followersTable.followerId, currentUserId), eq(followersTable.traderId, user.id)))
      .limit(1);
    isFollowing = follow.length > 0;
  }

  return {
    id: user.id,
    name: user.name,
    totalProfit: wallet[0] ? Number(wallet[0].totalProfit) : 0,
    winRate: Math.round(winRate * 10) / 10,
    totalTrades: closedTrades.length,
    followers: followers.length,
    isFollowing,
  };
}

// GET /api/copy-trading/top-traders
router.get("/top-traders", requireAuth, async (req: AuthRequest, res) => {
  try {
    const users = await db.select().from(usersTable);
    const traders = await Promise.all(users.map((u) => buildTopTrader(u, req.userId)));
    traders.sort((a, b) => b.totalProfit - a.totalProfit);
    res.json(traders.slice(0, 20));
  } catch (err) {
    logger.error({ err }, "Top traders error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/copy-trading/following
router.get("/following", requireAuth, async (req: AuthRequest, res) => {
  try {
    const follows = await db.select().from(followersTable).where(eq(followersTable.followerId, req.userId!));
    const traders = await Promise.all(
      follows.map(async (f) => {
        const [user] = await db.select().from(usersTable).where(eq(usersTable.id, f.traderId)).limit(1);
        if (!user) return null;
        return buildTopTrader(user, req.userId);
      })
    );
    res.json(traders.filter(Boolean));
  } catch (err) {
    logger.error({ err }, "Following error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/copy-trading/follow
router.post("/follow", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { traderId } = req.body;
    if (!traderId) {
      res.status(400).json({ error: "traderId required" });
      return;
    }
    if (traderId === req.userId) {
      res.status(400).json({ error: "Cannot follow yourself" });
      return;
    }

    const existing = await db.select().from(followersTable)
      .where(and(eq(followersTable.followerId, req.userId!), eq(followersTable.traderId, traderId)))
      .limit(1);

    if (existing.length === 0) {
      await db.insert(followersTable).values({ followerId: req.userId!, traderId });
    }

    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "Follow error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/copy-trading/unfollow
router.post("/unfollow", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { traderId } = req.body;
    if (!traderId) {
      res.status(400).json({ error: "traderId required" });
      return;
    }

    await db.delete(followersTable)
      .where(and(eq(followersTable.followerId, req.userId!), eq(followersTable.traderId, traderId)));

    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "Unfollow error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

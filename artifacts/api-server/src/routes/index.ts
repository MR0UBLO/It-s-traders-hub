import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import authRouter from "./auth.js";
import walletRouter from "./wallet.js";
import marketRouter from "./market.js";
import tradesRouter from "./trades.js";
import depositsRouter from "./deposits.js";
import mpesaRouter from "./mpesa.js";
import leaderboardRouter from "./leaderboard.js";
import copyTradingRouter from "./copy-trading.js";
import adminRouter from "./admin.js";
import dashboardRouter from "./dashboard.js";
import signalsRouter from "./signals.js";
import candlesRouter from "./candles.js";
import notificationsRouter from "./notifications.js";
import demoRouter from "./demo.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/wallet", walletRouter);
router.use("/market", marketRouter);
router.use("/market/candles", candlesRouter);
router.use("/trades", tradesRouter);
router.use("/deposits", depositsRouter);
router.use("/mpesa", mpesaRouter);
router.use("/leaderboard", leaderboardRouter);
router.use("/copy-trading", copyTradingRouter);
router.use("/admin", adminRouter);
router.use("/dashboard", dashboardRouter);
router.use("/signals", signalsRouter);
router.use("/notifications", notificationsRouter);
router.use("/demo", demoRouter);

export default router;

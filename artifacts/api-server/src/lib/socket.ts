import { Server } from "socket.io";
import type { Server as HttpServer } from "http";
import { logger } from "./logger.js";

let io: Server | null = null;

export function createSocketServer(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    path: "/api/socket.io",
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
    transports: ["websocket", "polling"],
  });

  io.on("connection", (socket) => {
    logger.info({ socketId: socket.id }, "Socket connected");

    socket.on("join-user", (userId: string | number) => {
      const room = `user:${userId}`;
      socket.join(room);
      logger.info({ socketId: socket.id, room }, "Socket joined user room");
    });

    socket.on("leave-user", (userId: string | number) => {
      socket.leave(`user:${userId}`);
    });

    socket.on("disconnect", (reason) => {
      logger.info({ socketId: socket.id, reason }, "Socket disconnected");
    });
  });

  return io;
}

export const socketIO = {
  emitPriceUpdate(data: unknown): void {
    io?.emit("price-update", data);
  },
  emitCandleUpdate(data: unknown): void {
    io?.emit("candle-update", data);
  },
  emitSignalUpdate(data: unknown): void {
    io?.emit("signal-update", data);
  },
  emitTradeUpdate(userId: number, data: unknown): void {
    io?.to(`user:${userId}`).emit("trade-update", data);
  },
  emitWalletUpdate(userId: number, data: unknown): void {
    io?.to(`user:${userId}`).emit("wallet-update", data);
  },
  emitNotification(userId: number, data: unknown): void {
    io?.to(`user:${userId}`).emit("notification", data);
  },
  connectedClients(): number {
    return io?.engine.clientsCount ?? 0;
  },
};

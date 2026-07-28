import swaggerJsdoc from "swagger-jsdoc";

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "TradersHub API",
      version: "2.0.0",
      description:
        "Production-grade fintech trading simulator API. Supports JWT auth, real-time WebSocket events, simulated market data with OHLC candles, AI signal generation, M-PESA deposits, copy trading, and leaderboard.",
    },
    servers: [{ url: "/api", description: "API base path" }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
      schemas: {
        MarketPrice: {
          type: "object",
          properties: {
            symbol: { type: "string", example: "BTCUSD" },
            bid: { type: "number", example: 97420.5 },
            ask: { type: "number", example: 97470.5 },
            spread: { type: "number", example: 50 },
            change24h: { type: "number" },
            changePercent24h: { type: "number" },
          },
        },
        Candle: {
          type: "object",
          properties: {
            time: { type: "integer", description: "Unix timestamp ms" },
            open: { type: "number" },
            high: { type: "number" },
            low: { type: "number" },
            close: { type: "number" },
            volume: { type: "integer" },
          },
        },
        AiSignal: {
          type: "object",
          properties: {
            id: { type: "integer" },
            symbol: { type: "string" },
            direction: { type: "string", enum: ["BUY", "SELL", "HOLD"] },
            confidence: { type: "integer", minimum: 0, maximum: 100 },
            risk: { type: "string", enum: ["LOW", "MEDIUM", "HIGH"] },
            timeframe: { type: "string", example: "H1" },
            reason: { type: "string" },
            entry: { type: "string" },
            target: { type: "string" },
            stopLoss: { type: "string" },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        Trade: {
          type: "object",
          properties: {
            id: { type: "integer" },
            symbol: { type: "string" },
            direction: { type: "string", enum: ["buy", "sell"] },
            amount: { type: "number" },
            entryPrice: { type: "number" },
            closePrice: { type: "number", nullable: true },
            profitLoss: { type: "number", nullable: true },
            status: { type: "string", enum: ["open", "closed"] },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        Error: {
          type: "object",
          properties: { error: { type: "string" } },
        },
      },
    },
    paths: {
      "/healthz": {
        get: {
          tags: ["System"],
          summary: "Health check",
          responses: { "200": { description: "OK" } },
        },
      },
      "/auth/register": {
        post: {
          tags: ["Auth"],
          summary: "Register new account",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["name", "email", "password"],
                  properties: {
                    name: { type: "string" },
                    email: { type: "string", format: "email" },
                    password: { type: "string", minLength: 6 },
                  },
                },
              },
            },
          },
          responses: {
            "201": { description: "Account created, OTP sent to email" },
            "400": { description: "Validation error" },
            "409": { description: "Email already registered" },
          },
        },
      },
      "/auth/login": {
        post: {
          tags: ["Auth"],
          summary: "Login",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["email", "password"],
                  properties: {
                    email: { type: "string" },
                    password: { type: "string" },
                  },
                },
              },
            },
          },
          responses: {
            "200": { description: "JWT token returned" },
            "401": { description: "Invalid credentials" },
          },
        },
      },
      "/market/prices": {
        get: {
          tags: ["Market"],
          summary: "Get live prices for all symbols",
          responses: {
            "200": {
              description: "Array of market prices",
              content: {
                "application/json": {
                  schema: { type: "array", items: { $ref: "#/components/schemas/MarketPrice" } },
                },
              },
            },
          },
        },
      },
      "/market/candles/{symbol}/{timeframe}": {
        get: {
          tags: ["Market"],
          summary: "Get OHLC candles",
          parameters: [
            {
              name: "symbol",
              in: "path",
              required: true,
              schema: { type: "string", enum: ["XAUUSD", "EURUSD", "BTCUSD", "GBPUSD", "USDJPY", "ETHUSD"] },
            },
            {
              name: "timeframe",
              in: "path",
              required: true,
              schema: { type: "string", enum: ["M1", "M5", "M15", "H1", "H4", "D1"] },
            },
          ],
          responses: {
            "200": {
              description: "Array of OHLC candles",
              content: {
                "application/json": {
                  schema: { type: "array", items: { $ref: "#/components/schemas/Candle" } },
                },
              },
            },
          },
        },
      },
      "/signals": {
        get: {
          tags: ["AI Signals"],
          summary: "Get recent AI signals (all symbols)",
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: "limit", in: "query", schema: { type: "integer", default: 20 } },
          ],
          responses: {
            "200": {
              description: "Array of AI signals",
              content: {
                "application/json": {
                  schema: { type: "array", items: { $ref: "#/components/schemas/AiSignal" } },
                },
              },
            },
          },
        },
      },
      "/signals/{symbol}": {
        get: {
          tags: ["AI Signals"],
          summary: "Get latest signal for a symbol",
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: "symbol",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": { description: "Latest AI signal for symbol" },
            "404": { description: "No signal found" },
          },
        },
      },
      "/trades": {
        get: {
          tags: ["Trading"],
          summary: "Get trade history",
          security: [{ bearerAuth: [] }],
          responses: {
            "200": {
              description: "Array of trades",
              content: {
                "application/json": {
                  schema: { type: "array", items: { $ref: "#/components/schemas/Trade" } },
                },
              },
            },
          },
        },
        post: {
          tags: ["Trading"],
          summary: "Open a new trade",
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["symbol", "direction", "amount"],
                  properties: {
                    symbol: { type: "string" },
                    direction: { type: "string", enum: ["buy", "sell"] },
                    amount: { type: "number" },
                  },
                },
              },
            },
          },
          responses: {
            "201": { description: "Trade opened" },
            "400": { description: "Insufficient balance or invalid input" },
          },
        },
      },
      "/trades/{id}/close": {
        post: {
          tags: ["Trading"],
          summary: "Close an open trade",
          security: [{ bearerAuth: [] }],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
          responses: {
            "200": { description: "Trade closed with P/L result" },
            "404": { description: "Trade not found" },
          },
        },
      },
      "/wallet/balance": {
        get: {
          tags: ["Wallet"],
          summary: "Get wallet balance",
          security: [{ bearerAuth: [] }],
          responses: {
            "200": {
              description: "Wallet details",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      balance: { type: "number" },
                      totalProfit: { type: "number" },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/notifications": {
        get: {
          tags: ["Notifications"],
          summary: "Get user notifications",
          security: [{ bearerAuth: [] }],
          responses: { "200": { description: "Array of notifications" } },
        },
      },
      "/admin/stats": {
        get: {
          tags: ["Admin"],
          summary: "Platform statistics (admin only)",
          security: [{ bearerAuth: [] }],
          responses: { "200": { description: "Platform stats" } },
        },
      },
    },
    tags: [
      { name: "System" },
      { name: "Auth" },
      { name: "Market" },
      { name: "AI Signals" },
      { name: "Trading" },
      { name: "Wallet" },
      { name: "Notifications" },
      { name: "Admin" },
    ],
  },
  apis: [],
};

export const swaggerSpec = swaggerJsdoc(options);

import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import routes from "./routes/index.js";
import { config } from "./config.js";
import type { AuthEnv } from "./middleware/auth.middleware.js";

const app = new Hono<AuthEnv>();

app.use("*", logger());

app.use(
  "*",
  cors({
    origin: config.corsOrigin,
    credentials: true,
  })
);

app.get("/api/health", (c) =>
  c.json({ status: "ok", service: "chatdocs-api", timestamp: new Date().toISOString() })
);

app.route("/api", routes);

app.onError((err, c) => {
  console.error("[API Error]", err);
  return c.json(
    { error: err instanceof Error ? err.message : "Internal server error" },
    500
  );
});

app.notFound((c) => c.json({ error: "Not found" }, 404));

export default app;

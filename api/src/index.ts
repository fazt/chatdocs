import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import routes from "./routes/index.js";
import { config } from "./config.js";

const app = express();

app.use(cors({
  origin: config.corsOrigin,
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

app.use("/api", routes);

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("[API Error]", err);
  res.status(500).json({ error: err.message || "Internal server error" });
});

app.listen(config.port, () => {
  console.log(`ChatDocs API server running on http://localhost:${config.port}`);
});

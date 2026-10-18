import { z } from "zod";

/**
 * Variables de entorno, validadas al arrancar: un `.env` incompleto falla en el
 * arranque y no a mitad de una petición. Plantilla: `apps/api/.env.example`.
 */
const bool = (def: boolean) =>
  z
    .enum(["true", "false", "1", "0"])
    .optional()
    .transform((v) => (v === undefined ? def : v === "true" || v === "1"));

const optional = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() ? v.trim() : undefined));

const DEV_SECRET = "folio-dev-secret-cambia-esto-en-produccion";

const schema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().positive().default(4095),
    HOST: z.string().default("0.0.0.0"),
    LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).optional(),
    DATABASE_URL: z.string().min(1, "Falta DATABASE_URL"),
    /** Firma tokens propios (checkout simulado). Mínimo 32 caracteres. */
    APP_SECRET: z.string().min(32, "APP_SECRET debe tener al menos 32 caracteres").default(DEV_SECRET),
    /** URL pública de la web (enlaces de los emails, retorno de pagos). */
    APP_URL: z.string().url().default("http://127.0.0.1:5264"),
    /** URL pública por la que llegan los webhooks (con nginx delante es la misma que APP_URL). */
    PUBLIC_API_URL: z.string().url().default("http://127.0.0.1:5264"),
    /** Orígenes permitidos (separados por coma): CORS y chequeo anti-CSRF por Origin. */
    CORS_ORIGIN: z.string().default("http://127.0.0.1:5264,http://localhost:5264"),
    COOKIE_SECURE: bool(false),
    SESSION_DAYS: z.coerce.number().int().min(1).max(90).default(30),
    /** true detrás de nginx: la IP del cliente sale de X-Forwarded-For. */
    TRUST_PROXY: bool(false),

    // --- IA: chat ---------------------------------------------------------------
    /** auto = anthropic si hay ANTHROPIC_API_KEY; openai si hay OPENAI_API_KEY; si no, mock (demo sin claves). */
    LLM_PROVIDER: z.enum(["auto", "anthropic", "openai", "mock"]).default("auto"),
    LLM_MAX_TOKENS: z.coerce.number().int().min(256).max(64000).default(8000),
    ANTHROPIC_API_KEY: optional,
    ANTHROPIC_MODEL: z.string().default("claude-opus-5-5"),
    ANTHROPIC_EFFORT: z.enum(["low", "medium", "high", "xhigh", "max"]).default("low"),
    ANTHROPIC_FALLBACKS: bool(true),
    OPENAI_API_KEY: optional,
    /** OpenAI o cualquier API compatible (Ollama http://localhost:11434/v1, vLLM, Groq…). */
    OPENAI_BASE_URL: z.string().url().default("https://api.openai.com/v1"),
    OPENAI_CHAT_MODEL: z.string().default("gpt-4o-mini"),

    // --- IA: embeddings -----------------------------------------------------------
    /** auto = openai si hay OPENAI_API_KEY; si no, mock (hashing determinista, funciona sin red). */
    EMBEDDING_PROVIDER: z.enum(["auto", "openai", "mock"]).default("auto"),
    EMBEDDING_MODEL: z.string().default("text-embedding-3-small"),

    // --- RAG -----------------------------------------------------------------------
    CHUNK_CHARS: z.coerce.number().int().min(400).max(8000).default(2400),
    CHUNK_OVERLAP_CHARS: z.coerce.number().int().min(0).max(2000).default(300),
    RAG_TOP_K: z.coerce.number().int().min(1).max(16).default(8),
    RAG_CANDIDATES: z.coerce.number().int().min(10).max(200).default(40),

    // --- Ingesta y almacenamiento ----------------------------------------------------
    MAX_UPLOAD_MB: z.coerce.number().int().min(1).max(200).default(25),
    MAX_PAGES_PER_DOCUMENT: z.coerce.number().int().min(1).max(5000).default(1500),
    INGEST_CONCURRENCY: z.coerce.number().int().min(1).max(8).default(2),
    WORKERS_ENABLED: bool(true),
    STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
    UPLOAD_DIR: z.string().default("./uploads"),
    S3_ENDPOINT: optional,
    S3_REGION: z.string().default("us-east-1"),
    S3_BUCKET: optional,
    S3_ACCESS_KEY_ID: optional,
    S3_SECRET_ACCESS_KEY: optional,
    S3_FORCE_PATH_STYLE: bool(false),

    // --- Email -----------------------------------------------------------------------
    MAIL_DRIVER: z.enum(["console", "resend"]).default("console"),
    RESEND_API_KEY: optional,
    MAIL_FROM: z.string().default("Folio <no-reply@folio.local>"),

    // --- Pagos (sandbox) -----------------------------------------------------------------
    PAYMENTS_SIMULATED_ENABLED: bool(false),
    STRIPE_SECRET_KEY: optional,
    STRIPE_WEBHOOK_SECRET: optional,
    PAYPAL_CLIENT_ID: optional,
    PAYPAL_CLIENT_SECRET: optional,
    PAYPAL_WEBHOOK_ID: optional,
    PAYPAL_ENV: z.enum(["sandbox", "live"]).default("sandbox"),
    MERCADOPAGO_ACCESS_TOKEN: optional,
    MERCADOPAGO_WEBHOOK_SECRET: optional,
    /** Mercado Pago cobra en moneda local: moneda y tipo de cambio desde USD. */
    MERCADOPAGO_CURRENCY: z.string().length(3).default("PEN"),
    MERCADOPAGO_FX_RATE: z.coerce.number().positive().default(3.75),

    // --- Seed --------------------------------------------------------------------------
    SEED_ADMIN_EMAIL: z.string().email().default("admin@folio.local"),
    SEED_ADMIN_PASSWORD: z.string().min(8).default("Admin12345!"),
    SEED_DEMO: bool(true),
  })
  .superRefine((value, ctx) => {
    if (value.NODE_ENV === "production" && value.APP_SECRET === DEV_SECRET) {
      ctx.addIssue({ code: "custom", path: ["APP_SECRET"], message: "Define un APP_SECRET propio en producción" });
    }
    if (value.LLM_PROVIDER === "anthropic" && !value.ANTHROPIC_API_KEY) {
      ctx.addIssue({ code: "custom", path: ["ANTHROPIC_API_KEY"], message: "LLM_PROVIDER=anthropic requiere ANTHROPIC_API_KEY" });
    }
    if (value.EMBEDDING_PROVIDER === "openai" && !value.OPENAI_API_KEY && value.OPENAI_BASE_URL.includes("api.openai.com")) {
      ctx.addIssue({ code: "custom", path: ["OPENAI_API_KEY"], message: "EMBEDDING_PROVIDER=openai requiere OPENAI_API_KEY" });
    }
    if (value.STORAGE_DRIVER === "s3" && (!value.S3_BUCKET || !value.S3_ACCESS_KEY_ID || !value.S3_SECRET_ACCESS_KEY)) {
      ctx.addIssue({ code: "custom", path: ["S3_BUCKET"], message: "STORAGE_DRIVER=s3 requiere S3_BUCKET, S3_ACCESS_KEY_ID y S3_SECRET_ACCESS_KEY" });
    }
    if (value.MAIL_DRIVER === "resend" && !value.RESEND_API_KEY) {
      ctx.addIssue({ code: "custom", path: ["RESEND_API_KEY"], message: "MAIL_DRIVER=resend requiere RESEND_API_KEY" });
    }
  });

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  // Aún no hay logger (depende de env): se usa la consola y se aborta.
  console.error("Configuración inválida:");
  for (const issue of parsed.error.issues) console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
  process.exit(1);
}

export const env = parsed.data;
export const isProduction = env.NODE_ENV === "production";
export const isTest = env.NODE_ENV === "test";
export const allowedOrigins = env.CORS_ORIGIN.split(",")
  .map((o) => o.trim())
  .filter(Boolean);

/** Dimensión fija de los vectores (columna vector(1536) en la migración). */
export const EMBEDDING_DIMENSIONS = 1536;

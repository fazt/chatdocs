import { defineConfig } from "vitest/config";

// Base de datos de test separada (la crea deploy/db/init-test-db.sql en el compose de desarrollo).
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgresql://folio:folio@127.0.0.1:5524/folio_test";

export const testEnv = {
  NODE_ENV: "test",
  DATABASE_URL: TEST_DATABASE_URL,
  TEST_DATABASE_URL,
  APP_SECRET: "test-app-secret-0123456789-abcdefghijklmnop",
  APP_URL: "http://web.test",
  PUBLIC_API_URL: "http://web.test",
  CORS_ORIGIN: "http://web.test",
  UPLOAD_DIR: "./.test-uploads",
  WORKERS_ENABLED: "false",
  LLM_PROVIDER: "mock",
  EMBEDDING_PROVIDER: "mock",
  ANTHROPIC_API_KEY: "",
  OPENAI_API_KEY: "",
  MAIL_DRIVER: "console",
  PAYMENTS_SIMULATED_ENABLED: "true",
  STRIPE_SECRET_KEY: "sk_test_dummy",
  STRIPE_WEBHOOK_SECRET: "whsec_test_dummy",
};

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    globalSetup: ["./test/global-setup.ts"],
    // Los tests de integración comparten la base: uno detrás de otro.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
    env: testEnv,
  },
});

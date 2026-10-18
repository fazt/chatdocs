import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createApp } from "../src/app.js";
import { db, schema } from "../src/db/client.js";
import { processDocument } from "../src/rag/ingest.js";
import { runExtraction } from "../src/rag/extraction.js";
import { consumeUsage } from "../src/lib/usage.js";
import { simulatedPaymentToken } from "../src/lib/crypto.js";
import { limiters } from "../src/lib/rate-limit.js";

const app = createApp();
const ORIGIN = "http://web.test";

/** Cliente mínimo con cookie de sesión y Origin permitido. */
function client() {
  let cookie = "";
  return async (path: string, init: RequestInit & { json?: unknown } = {}) => {
    const headers = new Headers(init.headers);
    headers.set("origin", ORIGIN);
    if (cookie) headers.set("cookie", cookie);
    if (init.json !== undefined) headers.set("content-type", "application/json");
    const res = await app.request(path, { ...init, headers, body: init.json !== undefined ? JSON.stringify(init.json) : init.body });
    const set = res.headers.get("set-cookie");
    if (set) cookie = set.split(";")[0]!;
    return res;
  };
}

let seq = 0;
async function registerUser(name = "Ana Torres") {
  // Todas las peticiones de test salen de la misma "IP": se reinicia el límite de registro.
  limiters.register.reset("desconocida");
  const call = client();
  const email = `user${Date.now()}${seq++}@test.pe`;
  const res = await call("/api/auth/register", { method: "POST", json: { email, password: "Clave12345", name } });
  expect(res.status).toBe(201);
  const body = (await res.json()) as { workspaceId: string; user: { id: string } };
  return { call, email, workspaceId: body.workspaceId, userId: body.user.id };
}

async function firstCollection(call: ReturnType<typeof client>, workspaceId: string): Promise<string> {
  const res = await call(`/api/workspaces/${workspaceId}/collections`);
  return ((await res.json()) as { collections: { id: string }[] }).collections[0]!.id;
}

const CONTRACT = `# Contrato

## Plazo
El contrato se renovará automáticamente salvo aviso con una anticipación no menor de noventa días calendario.

## Penalidad
La arrendataria pagará una penalidad equivalente a dos meses de renta si resuelve el contrato antes del mes dieciocho.`;

async function uploadAndIndex(call: ReturnType<typeof client>, workspaceId: string, collectionId: string, name = "contrato.md", text = CONTRACT) {
  const form = new FormData();
  form.set("file", new File([text], name, { type: "text/markdown" }));
  form.set("collectionId", collectionId);
  const res = await call(`/api/workspaces/${workspaceId}/documents`, { method: "POST", body: form });
  expect(res.status).toBe(202);
  const { document } = (await res.json()) as { document: { id: string } };
  await processDocument(document.id);
  return document.id;
}

describe("salud y rutas", () => {
  it("health comprueba la base", async () => {
    const res = await app.request("/api/health");
    expect(res.status).toBe(200);
  });
  it("una ruta inexistente responde 404 (no 401)", async () => {
    expect((await app.request("/api/no-existe")).status).toBe(404);
  });
  it("rechaza escrituras desde otro origen (CSRF)", async () => {
    const res = await app.request("/api/auth/login", {
      method: "POST",
      headers: { origin: "http://malicioso.test", "content-type": "application/json" },
      body: JSON.stringify({ email: "a@b.pe", password: "x" }),
    });
    expect(res.status).toBe(403);
  });
});

describe("autenticación", () => {
  it("registro, me, logout revoca la sesión", async () => {
    const { call } = await registerUser();
    const me = await call("/api/auth/me");
    const body = (await me.json()) as { user: { email: string }; workspaces: unknown[] };
    expect(body.workspaces).toHaveLength(1);
    await call("/api/auth/logout", { method: "POST" });
    expect(((await (await call("/api/auth/me")).json()) as { user: unknown }).user).toBeNull();
  });
  it("olvidé contraseña responde igual exista o no la cuenta", async () => {
    const call = client();
    const a = await call("/api/auth/forgot-password", { method: "POST", json: { email: "nadie@test.pe" } });
    expect(a.status).toBe(202);
  });
  it("desactivar a un usuario corta su sesión al instante", async () => {
    const { call, userId } = await registerUser();
    await db.update(schema.users).set({ disabledAt: new Date() }).where(eq(schema.users.id, userId));
    expect((await call("/api/workspaces", { method: "POST", json: { name: "Otro" } })).status).toBe(401);
    expect(((await (await call("/api/auth/me")).json()) as { user: unknown }).user).toBeNull();
  });
});

describe("documentos, chat y aislamiento entre espacios", () => {
  let owner: Awaited<ReturnType<typeof registerUser>>;
  let collectionId: string;
  let documentId: string;

  beforeAll(async () => {
    owner = await registerUser("Lucía Quispe");
    collectionId = await firstCollection(owner.call, owner.workspaceId);
    documentId = await uploadAndIndex(owner.call, owner.workspaceId, collectionId);
  });

  it("indexa por sección y guarda el texto de cada página", async () => {
    const res = await owner.call(`/api/workspaces/${owner.workspaceId}/documents/${documentId}/pages`);
    const body = (await res.json()) as { pages: { heading: string | null }[] };
    expect(body.pages.map((p) => p.heading)).toEqual(["Contrato", "Plazo", "Penalidad"]);
  });

  it("rechaza el mismo archivo dos veces en el expediente", async () => {
    const form = new FormData();
    form.set("file", new File([CONTRACT], "copia.md"));
    form.set("collectionId", collectionId);
    const res = await owner.call(`/api/workspaces/${owner.workspaceId}/documents`, { method: "POST", body: form });
    expect(res.status).toBe(409);
  });

  it("responde en streaming con citas literales verificadas", async () => {
    const created = await owner.call(`/api/workspaces/${owner.workspaceId}/conversations`, { method: "POST", json: { collectionId } });
    const { conversation } = (await created.json()) as { conversation: { id: string } };
    const res = await owner.call(`/api/workspaces/${owner.workspaceId}/conversations/${conversation.id}/messages`, {
      method: "POST",
      json: { message: "¿Qué penalidad hay si se resuelve el contrato antes?" },
    });
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    const text = await res.text();
    expect(text).toContain("event: sources");
    const done = text.split("\n\n").find((block) => block.startsWith("event: done"))!;
    const payload = JSON.parse(done.split("\ndata: ")[1]!) as { verification: { quotes: number; verified: number } };
    expect(payload.verification.quotes).toBeGreaterThan(0);
    expect(payload.verification.verified).toBe(payload.verification.quotes);

    const exported = await owner.call(`/api/workspaces/${owner.workspaceId}/conversations/${conversation.id}/export?format=md`);
    expect(exported.headers.get("content-disposition")).toContain("attachment");
    expect(await exported.text()).toContain("✔ verificada");
  });

  it("otro usuario no ve el espacio ni sus documentos (404)", async () => {
    const intruder = await registerUser("Intruso");
    expect((await intruder.call(`/api/workspaces/${owner.workspaceId}/documents/${documentId}/file`)).status).toBe(404);
    // Ni usando su propio espacio con un id ajeno.
    expect((await intruder.call(`/api/workspaces/${intruder.workspaceId}/documents/${documentId}`)).status).toBe(404);
    // No puede mover un documento a un expediente de otro espacio.
    const foreignCollection = await firstCollection(intruder.call, intruder.workspaceId);
    const move = await owner.call(`/api/workspaces/${owner.workspaceId}/documents/${documentId}`, { method: "PATCH", json: { collectionId: foreignCollection } });
    expect(move.status).toBe(404);
  });

  it("un lector no puede subir ni borrar", async () => {
    const viewer = await registerUser("Lectora");
    await db.insert(schema.workspaceMembers).values({ workspaceId: owner.workspaceId, userId: viewer.userId, role: "viewer" });
    const del = await viewer.call(`/api/workspaces/${owner.workspaceId}/documents/${documentId}`, { method: "DELETE" });
    expect(del.status).toBe(403);
    expect((await viewer.call(`/api/workspaces/${owner.workspaceId}/documents/${documentId}/pages`)).status).toBe(200);
  });

  it("PATCH parcial de metadatos no borra los demás campos", async () => {
    const base = `/api/workspaces/${owner.workspaceId}/documents/${documentId}`;
    await owner.call(base, { method: "PATCH", json: { metadata: { parties: "A / B" } } });
    const res = await owner.call(base, { method: "PATCH", json: { metadata: { signedAt: "2026-02-15" } } });
    const { document } = (await res.json()) as { document: { metadata: Record<string, string> } };
    expect(document.metadata).toEqual({ parties: "A / B", signedAt: "2026-02-15" });
  });

  it("extrae campos con cita verificada y exporta CSV", async () => {
    const res = await owner.call(`/api/workspaces/${owner.workspaceId}/extractions`, {
      method: "POST",
      json: {
        collectionId,
        name: "Cláusulas",
        fields: [{ key: "penalidad", label: "Penalidad", instructions: "Penalidad por resolver el contrato antes" }],
        documentIds: [documentId],
      },
    });
    expect(res.status).toBe(202);
    const { extraction } = (await res.json()) as { extraction: { id: string } };
    await runExtraction(extraction.id);
    const csv = await (await owner.call(`/api/workspaces/${owner.workspaceId}/extractions/${extraction.id}/export`)).text();
    expect(csv).toContain("Penalidad");
    expect(csv).toContain('"sí"');
  });
});

describe("límites del plan", () => {
  it("el cupo mensual es atómico: con peticiones simultáneas nunca se supera", async () => {
    const { workspaceId } = await registerUser();
    // Plan Gratis: 100 preguntas. 130 intentos a la vez → exactamente 100 pasan.
    const results = await Promise.allSettled(Array.from({ length: 130 }, () => consumeUsage(workspaceId, "free", "questions")));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(100);
  });
});

describe("pagos", () => {
  it("el webhook simulado activa el plan una sola vez (idempotente)", async () => {
    const { call, workspaceId } = await registerUser("Dueña");
    const checkout = await call(`/api/workspaces/${workspaceId}/billing/checkout`, { method: "POST", json: { plan: "pro", provider: "simulated" } });
    expect(checkout.status).toBe(201);
    const { paymentId } = (await checkout.json()) as { paymentId: string };
    const body = JSON.stringify({ paymentId, token: simulatedPaymentToken(paymentId), outcome: "paid" });
    const send = () => app.request("/api/billing/webhooks/simulated", { method: "POST", headers: { "content-type": "application/json" }, body });
    const [a, b] = await Promise.all([send(), send()]);
    const statuses = [((await a.json()) as { status: string }).status, ((await b.json()) as { status: string }).status].sort();
    expect(statuses).toEqual(["duplicate", "processed"]);
    const [ws] = await db.select().from(schema.workspaces).where(eq(schema.workspaces.id, workspaceId));
    expect(ws!.plan).toBe("pro");
    const days = (ws!.planExpiresAt!.getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(29);
    expect(days).toBeLessThan(31);
  });
  it("rechaza un token simulado falso", async () => {
    const res = await app.request("/api/billing/webhooks/simulated", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ paymentId: crypto.randomUUID(), token: "falso", outcome: "paid" }),
    });
    expect(res.status).toBe(400);
  });
});

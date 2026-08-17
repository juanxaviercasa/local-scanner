import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({
  getOrCreateHandoffIntegration: vi.fn(),
  updateHandoffIntegration: vi.fn(),
}));

vi.mock("./db", async importOriginal => {
  const actual = await importOriginal<typeof import("./db")>();
  return { ...actual, ...mocks };
});

vi.mock("./handoffWebhook", async importOriginal => {
  const actual = await importOriginal<typeof import("./handoffWebhook")>();
  return { ...actual, validateWebhookUrl: vi.fn(async (value: string) => value) };
});

import { appRouter } from "./routers";

function context(): TrpcContext {
  return {
    user: { id: 34, openId: "integration-test", name: "Prueba", email: "prueba@nexo.local", loginMethod: "manus", role: "admin", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("handoffs.integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getOrCreateHandoffIntegration.mockResolvedValue({ id: 7, ownerId: 34, displayName: "SaaS de auditoría web", webhookUrl: null, isEnabled: 0, lastDeliveryStatus: "not_sent", lastDeliveryError: null });
    mocks.updateHandoffIntegration.mockImplementation(async (_ownerId, data) => ({ id: 7, ownerId: 34, displayName: "SaaS de auditoría web", webhookUrl: null, isEnabled: 0, lastDeliveryStatus: "not_sent", lastDeliveryError: null, ...data }));
  });

  it("recupera la configuración de la cuenta sin exponer el secreto de firma", async () => {
    const caller = appRouter.createCaller(context());
    await expect(caller.handoffs.integration()).resolves.toMatchObject({ ownerId: 34, hasSigningSecret: false, isEnabled: 0 });
    expect(mocks.getOrCreateHandoffIntegration).toHaveBeenCalledWith(34);
  });

  it("permite guardar un destino desactivado y bloquea la activación sin secreto", async () => {
    const caller = appRouter.createCaller(context());
    await expect(caller.handoffs.updateIntegration({ displayName: "Auditoría externa", webhookUrl: null, isEnabled: false })).resolves.toMatchObject({ displayName: "Auditoría externa", isEnabled: 0 });
    expect(mocks.updateHandoffIntegration).toHaveBeenCalledWith(34, { displayName: "Auditoría externa", webhookUrl: null, isEnabled: 0 });
    await expect(caller.handoffs.updateIntegration({ displayName: "Auditoría externa", webhookUrl: "https://saas.example.com/hook", isEnabled: true })).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });
});

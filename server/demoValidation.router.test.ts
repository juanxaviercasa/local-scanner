import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({
  listProspects: vi.fn(),
  getOrCreateDefaultScoringProfile: vi.fn(),
  createProspectingRun: vi.fn(),
  updateProspectingRun: vi.fn(),
  createRunEvent: vi.fn(),
  createRawSearchResult: vi.fn(),
  upsertBusinessFromProvider: vi.fn(),
  createRunProspect: vi.fn(),
  getProspectingRun: vi.fn(),
  createProspectActivity: vi.fn(),
}));

vi.mock("./db", async importOriginal => {
  const actual = await importOriginal<typeof import("./db")>();
  return { ...actual, ...mocks };
});

import { appRouter } from "./routers";

function contextForDemo(): TrpcContext {
  return {
    user: { id: 91, openId: "demo-router-test", name: "Prueba", email: "demo@nexo.local", loginMethod: "manus", role: "admin", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("demo.createValidation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getOrCreateDefaultScoringProfile.mockResolvedValue({ weights: {}, thresholds: {} });
    mocks.createProspectingRun.mockResolvedValue({ id: 501, query: "Entrada manual: Ejemplo de validación en Entorno local" });
    mocks.updateProspectingRun.mockResolvedValue({});
    mocks.createRunEvent.mockResolvedValue({});
    mocks.createRawSearchResult.mockResolvedValue({});
    mocks.upsertBusinessFromProvider.mockResolvedValue({ business: { id: 700 }, isKnown: false });
    mocks.createRunProspect.mockResolvedValue({});
    mocks.getProspectingRun.mockResolvedValue({ id: 501 });
    mocks.createProspectActivity.mockResolvedValue({});
    mocks.listProspects.mockImplementation(async (_ownerId: number, filters: { query?: string; runId?: number }) => {
      if (filters.query) return [];
      if (filters.runId) return [{ prospect: { id: 701, status: "new" }, business: { name: "NEGOCIO DE DEMOSTRACIÓN — VALIDACIÓN LOCAL" } }];
      return [];
    });
  });

  it("crea el ejemplo y registra su seguimiento a través del procedimiento protegido", async () => {
    const caller = appRouter.createCaller(contextForDemo());
    await expect(caller.demo.createValidation()).resolves.toEqual({ prospectId: 701, created: true });

    expect(mocks.createProspectActivity).toHaveBeenCalledWith(expect.objectContaining({
      ownerId: 91,
      prospectId: 701,
      action: "follow_up_scheduled",
      nextStatus: "contact_pending",
      nextActionLabel: "Revisar el flujo de demostración",
    }));
    expect(mocks.upsertBusinessFromProvider).toHaveBeenCalledWith(expect.objectContaining({
      name: "NEGOCIO DE DEMOSTRACIÓN — VALIDACIÓN LOCAL",
      rating: null,
      reviewCount: null,
    }));
  });
});

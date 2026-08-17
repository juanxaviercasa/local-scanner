import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({
  getProspect: vi.fn(),
  getOrCreateHandoffPolicy: vi.fn(),
  listWebsiteAnalyses: vi.fn(),
  getProspectHandoff: vi.fn(),
  upsertProspectHandoff: vi.fn(),
  updateProspectHandoff: vi.fn(),
  createProspectActivity: vi.fn(),
}));

vi.mock("./db", async importOriginal => {
  const actual = await importOriginal<typeof import("./db")>();
  return { ...actual, ...mocks };
});

import { appRouter } from "./routers";

function contextForDemo(): TrpcContext {
  return {
    user: { id: 97, openId: "demo-handoff-test", name: "Prueba", email: "demo@nexo.local", loginMethod: "manus", role: "admin", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

const demoProspect = {
  business: { id: 700, name: "NEGOCIO DE DEMOSTRACIÓN — VALIDACIÓN LOCAL", isDemo: 1, websiteStatus: "no_website" as const },
  prospect: { id: 701, status: "contact_pending" as const, opportunityScore: 92, nextActionLabel: "Revisar", nextActionAt: new Date("2026-09-10T12:00:00.000Z"), priority: "p1", opportunityTypes: [], scoreReasons: [], analysisSummary: null },
};

describe("handoffs con demostraciones", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getProspect.mockResolvedValue(demoProspect);
    mocks.getOrCreateHandoffPolicy.mockResolvedValue({ minimumOpportunityScore: 70, requireNextAction: 1, requireDigitalEvidence: 1, destinationLabel: "SaaS de auditoría web" });
    mocks.listWebsiteAnalyses.mockResolvedValue([]);
    mocks.getProspectHandoff.mockResolvedValue({ status: "approved" });
  });

  it("rechaza en la cola un prospecto de demostración aunque tenga score y seguimiento válidos", async () => {
    const caller = appRouter.createCaller(contextForDemo());
    await expect(caller.handoffs.queue({ prospectId: 701 })).rejects.toThrow("demostración");
    expect(mocks.upsertProspectHandoff).not.toHaveBeenCalled();
    expect(mocks.createProspectActivity).not.toHaveBeenCalled();
  });

  it("rechaza antes de generar el expediente de auditoría de una demostración", async () => {
    const caller = appRouter.createCaller(contextForDemo());
    await expect(caller.handoffs.dossier({ prospectId: 701, markExported: true })).rejects.toThrow("demostración");
    expect(mocks.updateProspectHandoff).not.toHaveBeenCalled();
    expect(mocks.createProspectActivity).not.toHaveBeenCalled();
  });
});

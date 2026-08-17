import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({
  getOrCreateGuideProgress: vi.fn(),
  updateGuideProgress: vi.fn(),
  getOrCreateWebScopeTemplates: vi.fn(),
  createWebScopeTemplate: vi.fn(),
  updateWebScopeTemplate: vi.fn(),
  deleteWebScopeTemplate: vi.fn(),
}));

vi.mock("./db", async importOriginal => {
  const actual = await importOriginal<typeof import("./db")>();
  return { ...actual, ...mocks };
});

import { appRouter } from "./routers";

function context(): TrpcContext {
  return {
    user: { id: 21, openId: "scope-test", name: "Prueba", email: "prueba@nexo.local", loginMethod: "manus", role: "admin", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

const template = {
  name: "Servicios profesionales",
  sector: "Consultoría",
  overview: "Sitio orientado a explicar servicios y captar solicitudes cualificadas.",
  deliverables: ["Página de servicios", "Formulario de contacto"],
  successMetrics: ["Solicitudes cualificadas", "Tasa de conversión"],
};

describe("guide y scopeTemplates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getOrCreateGuideProgress.mockResolvedValue({ ownerId: 21, completedSteps: [0, 2] });
    mocks.updateGuideProgress.mockImplementation(async (_ownerId, completedSteps) => ({ ownerId: 21, completedSteps }));
    mocks.getOrCreateWebScopeTemplates.mockResolvedValue([{ id: 5, ...template, isDefault: 1 }]);
    mocks.createWebScopeTemplate.mockImplementation(async (_ownerId, input) => ({ id: 6, ...input, isDefault: 0 }));
    mocks.updateWebScopeTemplate.mockImplementation(async (_ownerId, templateId, input) => ({ id: templateId, ...template, ...input, isDefault: 0 }));
    mocks.deleteWebScopeTemplate.mockResolvedValue({ id: 5 });
  });

  it("recupera y actualiza el progreso por usuario", async () => {
    const caller = appRouter.createCaller(context());
    await expect(caller.guide.progress()).resolves.toMatchObject({ completedSteps: [0, 2] });
    await expect(caller.guide.updateProgress({ completedSteps: [0, 1, 4] })).resolves.toMatchObject({ completedSteps: [0, 1, 4] });
    expect(mocks.getOrCreateGuideProgress).toHaveBeenCalledWith(21);
    expect(mocks.updateGuideProgress).toHaveBeenCalledWith(21, [0, 1, 4]);
  });

  it("crea, actualiza y elimina plantillas solo dentro de la cuenta actual", async () => {
    const caller = appRouter.createCaller(context());
    await expect(caller.scopeTemplates.list()).resolves.toHaveLength(1);
    await expect(caller.scopeTemplates.create(template)).resolves.toMatchObject({ id: 6, name: template.name });
    await expect(caller.scopeTemplates.update({ templateId: 6, name: "Consultoría premium", overview: template.overview })).resolves.toMatchObject({ id: 6, name: "Consultoría premium" });
    await expect(caller.scopeTemplates.remove({ templateId: 5 })).resolves.toMatchObject({ id: 5 });
    expect(mocks.getOrCreateWebScopeTemplates).toHaveBeenCalledWith(21);
    expect(mocks.createWebScopeTemplate).toHaveBeenCalledWith(21, template);
    expect(mocks.updateWebScopeTemplate).toHaveBeenCalledWith(21, 6, { name: "Consultoría premium", overview: template.overview });
    expect(mocks.deleteWebScopeTemplate).toHaveBeenCalledWith(21, 5);
  });
});

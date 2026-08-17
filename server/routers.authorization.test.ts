import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function contextFor(role: "admin" | "user" | null): TrpcContext {
  return {
    user: role
      ? {
          id: 42,
          openId: "authorization-test-user",
          name: "Usuario de prueba",
          email: "test@nexo.local",
          loginMethod: "manus",
          role,
          createdAt: new Date(),
          updatedAt: new Date(),
          lastSignedIn: new Date(),
        }
      : null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("protección de rutas de Nexo Ops", () => {
  it("rechaza los módulos privados cuando no existe sesión", async () => {
    const caller = appRouter.createCaller(contextFor(null));
    await expect(caller.dashboard.metrics()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("rechaza el panel administrativo para usuarios sin rol administrador", async () => {
    const caller = appRouter.createCaller(contextFor("user"));
    await expect(caller.admin.users()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

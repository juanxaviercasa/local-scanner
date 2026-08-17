import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const dbMocks = vi.hoisted(() => ({
  createSearchProfile: vi.fn(),
  listSearchProfiles: vi.fn(),
}));

vi.mock("./db", async () => {
  const actual = await vi.importActual<typeof import("./db")>("./db");
  return { ...actual, createSearchProfile: dbMocks.createSearchProfile, listSearchProfiles: dbMocks.listSearchProfiles };
});

const { appRouter } = await import("./routers");

const context: TrpcContext = {
  user: { id: 42, openId: "perfil-test", name: "Perfil test", email: null, loginMethod: "manus", role: "user", avatarUrl: null, themePreference: "system", timezone: "UTC", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
  req: { protocol: "https", headers: {} } as TrpcContext["req"],
  res: {} as TrpcContext["res"],
};

describe("contrato de perfiles de búsqueda", () => {
  it("guarda y devuelve la fuente autorizada seleccionada", async () => {
    const persistedProfiles: Array<Record<string, unknown>> = [];
    dbMocks.createSearchProfile.mockImplementation(async (_ownerId, input) => {
      const storedProfile = { id: 9, ...input };
      persistedProfiles.push(storedProfile);
      return storedProfile;
    });
    dbMocks.listSearchProfiles.mockImplementation(async () => persistedProfiles);
    const caller = appRouter.createCaller(context);

    const created = await caller.searchProfiles.create({ name: "Talleres desde entrada manual", provider: "manual_entry", country: "Perú", city: "Lima", primaryCategory: "talleres" });
    const listed = await caller.searchProfiles.list();

    expect(dbMocks.createSearchProfile).toHaveBeenCalledWith(42, expect.objectContaining({ name: "Talleres desde entrada manual", provider: "manual_entry" }));
    expect(created.provider).toBe("manual_entry");
    expect(listed).toEqual([expect.objectContaining({ id: created.id, provider: created.provider })]);
  });
});

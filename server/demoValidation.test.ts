import { describe, expect, it, vi } from "vitest";
import { createValidationDemo, getValidationDemoImport } from "./demoValidation";

describe("ejemplo de validación", () => {
  it("no incorpora reseñas ni calificaciones ficticias", () => {
    const example = getValidationDemoImport();
    expect(example.source).toBe("manual_entry");
    expect(example.records).toHaveLength(1);
    expect(example.records[0]).toMatchObject({
      name: "NEGOCIO DE DEMOSTRACIÓN — VALIDACIÓN LOCAL",
      rating: null,
      reviewCount: null,
      website: null,
    });
  });

  it("crea el prospecto sintético y registra la próxima acción en la bitácora", async () => {
    const listProspects = vi.fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ prospect: { id: 77, status: "new" }, business: { name: "NEGOCIO DE DEMOSTRACIÓN — VALIDACIÓN LOCAL" } }]);
    const importBusinesses = vi.fn().mockResolvedValue({ id: 13 });
    const updateRunProspect = vi.fn().mockResolvedValue({});
    const createProspectActivity = vi.fn().mockResolvedValue({});

    await expect(createValidationDemo(9, { listProspects, importBusinesses, updateRunProspect, createProspectActivity, now: () => new Date("2026-08-17T00:00:00.000Z") })).resolves.toEqual({ prospectId: 77, created: true });
    expect(importBusinesses).toHaveBeenCalledWith(9, expect.objectContaining({ source: "manual_entry" }));
    expect(updateRunProspect).toHaveBeenCalledWith(9, 77, expect.objectContaining({ status: "contact_pending", nextActionLabel: "Revisar el flujo de demostración", nextActionAt: new Date("2026-08-20T00:00:00.000Z") }));
    expect(createProspectActivity).toHaveBeenCalledWith(expect.objectContaining({ ownerId: 9, prospectId: 77, action: "follow_up_scheduled", nextStatus: "contact_pending" }));
  });
});

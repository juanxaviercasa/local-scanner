import { describe, expect, it } from "vitest";
import { buildProspectFollowup } from "./prospectFollowup";

describe("seguimiento comercial de prospectos", () => {
  it("registra una próxima acción y conserva el estado previo cuando no se modifica", () => {
    const dueAt = new Date("2026-08-20T15:00:00.000Z");
    const result = buildProspectFollowup({ status: "qualified", nextActionLabel: null, nextActionAt: null }, { nextActionLabel: "Llamar para confirmar interés", nextActionAt: dueAt });
    expect(result.hasCommercialChange).toBe(true);
    expect(result.activity.action).toBe("follow_up_scheduled");
    expect(result.nextStatus).toBe("qualified");
    expect(result.nextActionAt).toEqual(dueAt);
  });

  it("marca el primer contacto y permite limpiar una próxima acción programada", () => {
    const result = buildProspectFollowup({ status: "contact_pending", nextActionLabel: "Enviar propuesta", nextActionAt: new Date("2026-08-19T15:00:00.000Z") }, { status: "contacted", nextActionLabel: null, nextActionAt: null, commercialNote: "Contacto inicial realizado." });
    expect(result.markContactedAt).toBe(true);
    expect(result.activity.action).toBe("status_changed");
    expect(result.nextActionLabel).toBeNull();
    expect(result.nextActionAt).toBeNull();
  });
});

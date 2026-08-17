import { describe, expect, it } from "vitest";
import { actualUsageStaysWithinPlan, buildCsvDocument, calculateProspectingPlan } from "./scannerPolicies";

const budget = { dailyRequestBudget: 100, monthlyRequestBudget: 1000, maxCostPerRunCents: 500, maxBusinessesPerRun: 15 };

describe("políticas críticas del scanner", () => {
  it("previsualiza un plan limitado al tamaño de página y al presupuesto de la cuenta", () => {
    const plan = calculateProspectingPlan({ maxResults: 50 }, budget, { dailyRequests: 10, monthlyRequests: 20 }, 10);
    expect(plan.requested).toBe(15);
    expect(plan.estimatedOperations).toBe(17);
    expect(plan.estimatedCostCents).toBe(170);
    expect(plan.allowed).toBe(false);
    expect(plan.reasons[0]).toContain("15 negocios");
  });

  it("bloquea un plan que excede el consumo diario disponible", () => {
    const plan = calculateProspectingPlan({ maxResults: 10 }, budget, { dailyRequests: 90, monthlyRequests: 100 }, 0);
    expect(plan.allowed).toBe(false);
    expect(plan.reasons).toContain("La ejecución supera el presupuesto diario de solicitudes.");
  });

  it("ordena detener el procesamiento si el consumo real supera el plan autorizado", () => {
    expect(actualUsageStaysWithinPlan(13, 130, { estimatedOperations: 12 }, budget)).toBe(false);
    expect(actualUsageStaysWithinPlan(12, 500, { estimatedOperations: 12 }, budget)).toBe(true);
  });

  it("genera un CSV seguro para Google Sheets y protege celdas interpretables como fórmulas", () => {
    const csv = buildCsvDocument([{ business_name: 'Clínica "Centro"', notes: "=HYPERLINK(\"https://ejemplo.com\")", tags: ["sin web", "alta prioridad"] }]);
    expect(csv).toContain('"Clínica ""Centro"""');
    expect(csv).toContain('"\'=HYPERLINK(""https://ejemplo.com"")"');
    expect(csv).toContain('"[""sin web"",""alta prioridad""]"');
  });
});

import { describe, expect, it } from "vitest";
import { assertGoogleSheetsEligibility } from "./routers";

describe("elegibilidad de la exportación opcional a Google Sheets", () => {
  it("permite entregar exclusivamente prospectos cualificados", () => {
    expect(() => assertGoogleSheetsEligibility(["qualified", "qualified"])).not.toThrow();
  });

  it("rechaza prospectos que no están cualificados antes de cualquier entrega", () => {
    expect(() => assertGoogleSheetsEligibility(["qualified", "analyzed"])).toThrow("Solo se pueden entregar a Google Sheets prospectos cualificados");
  });
});

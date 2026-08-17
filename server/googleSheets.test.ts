import { afterEach, describe, expect, it } from "vitest";
import { ENV } from "./_core/env";
import { isGoogleSheetsConfigured, rowsToSheetValues } from "./googleSheets";

const originalConfiguration = { paidConnectorsEnabled: ENV.paidConnectorsEnabled, googleServiceAccountJson: ENV.googleServiceAccountJson, googleSheetsSpreadsheetId: ENV.googleSheetsSpreadsheetId };

afterEach(() => Object.assign(ENV, originalConfiguration));

describe("exportación opcional a Google Sheets", () => {
  it("mantiene un orden estable de columnas y neutraliza fórmulas de hoja de cálculo", () => {
    const rendered = rowsToSheetValues([
      { business_name: "=IMPORTXML(A1)", score: 82, reasons: ["Sin web", "Teléfono disponible"] },
      { business_name: "+Negocio local", score: 44, reasons: [] },
    ]);

    expect(rendered.headers).toEqual(["business_name", "score", "reasons"]);
    expect(rendered.values).toEqual([
      ["'=IMPORTXML(A1)", 82, '["Sin web","Teléfono disponible"]'],
      ["'+Negocio local", 44, "[]"],
    ]);
  });

  it("produce una estructura vacía cuando no se seleccionan prospectos", () => {
    expect(rowsToSheetValues([])).toEqual({ headers: [], values: [] });
  });

  it("mantiene el conector como placeholder mientras no exista una activación expresa", () => {
    Object.assign(ENV, { paidConnectorsEnabled: false, googleServiceAccountJson: "{\"client_email\":\"scanner@example.com\"}", googleSheetsSpreadsheetId: "sheet-id" });

    expect(isGoogleSheetsConfigured()).toBe(false);
  });
});

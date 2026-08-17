import { describe, expect, it } from "vitest";
import { calibrateScoringWeights } from "./scoringCalibration";

const rows = Array.from({ length: 10 }, (_, index) => ({
  outcome: index < 6 ? "won" as const : "lost" as const,
  noWebsite: index < 5,
  weakWebsite: index % 2 === 0,
  reviewCount: index < 6 ? 180 : 20,
  rating: index < 6 ? 4.7 : 3.8,
  hasPhone: index < 7,
  hasBooking: index >= 5,
  hasWhatsapp: index >= 4,
  commercialPotential: index < 6 ? "high" as const : "medium" as const,
}));

describe("calibración del Opportunity Score", () => {
  it("deriva recomendaciones explicables sin escribir ni inventar datos", () => {
    const result = calibrateScoringWeights(rows);
    expect(result.validRows).toBe(10);
    expect(result.won).toBe(6);
    expect(result.stableFactors).toBeGreaterThan(0);
    expect(result.recommendedWeights.noWebsite).toBeTypeOf("number");
    expect(result.explanations.some(item => item.key === "noWebsite")).toBe(true);
  });

  it("exige una muestra mínima de resultados etiquetados", () => {
    expect(() => calibrateScoringWeights(rows.slice(0, 7))).toThrow("al menos 8");
  });
});

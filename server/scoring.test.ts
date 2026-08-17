import { describe, expect, it } from "vitest";
import { scoreBusiness } from "./scoring";

describe("Opportunity Score", () => {
  it("prioriza una oportunidad sólida cuando el negocio no tiene sitio web", () => {
    const result = scoreBusiness({
      rating: 4.8,
      reviewCount: 650,
      websiteStatus: "no_website",
      websiteQuality: "not_analyzed",
      hasPhone: true,
      hasBooking: false,
      hasWhatsapp: false,
      commercialPotential: "very_high",
    });

    expect(result.opportunityScore).toBeGreaterThanOrEqual(70);
    expect(["p0", "p1"]).toContain(result.priority);
    expect(result.opportunityTypes).toContain("CREAR SITIO WEB");
    expect(result.reasons.some(reason => reason.label === "No se encontró sitio web propio")).toBe(true);
  });

  it("expone una oportunidad de rediseño ante un sitio web débil", () => {
    const result = scoreBusiness({
      rating: 4.5,
      reviewCount: 140,
      websiteStatus: "website_found",
      websiteQuality: "weak",
      hasPhone: true,
      hasBooking: true,
      hasWhatsapp: true,
      commercialPotential: "high",
    });

    expect(result.opportunityTypes).toContain("REDISEÑAR SITIO WEB");
    expect(result.reasons.some(reason => reason.label.includes("sitio web mejorable"))).toBe(true);
    expect(result.websiteOpportunityScore).toBeGreaterThan(0);
  });

  it("no inventa una oportunidad digital concluyente cuando no existen señales", () => {
    const result = scoreBusiness({
      rating: null,
      reviewCount: null,
      websiteStatus: "website_unknown",
      websiteQuality: "not_analyzed",
      hasPhone: false,
      hasBooking: true,
      hasWhatsapp: true,
      commercialPotential: "low",
    });

    expect(result.opportunityTypes).toEqual([]);
    expect(result.summary).toContain("No hay una oportunidad digital concluyente");
  });
});

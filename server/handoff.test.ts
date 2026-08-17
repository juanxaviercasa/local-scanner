import { describe, expect, it } from "vitest";
import { buildAuditDossier, evaluateHandoffEligibility } from "./handoff";

const policy = { minimumOpportunityScore: 70, requireNextAction: true, requireDigitalEvidence: true };

describe("cola de transición", () => {
  it("solo habilita la auditoría cuando se cumplen score, seguimiento y evidencia digital", () => {
    const eligibility = evaluateHandoffEligibility({ status: "contact_pending", opportunityScore: 82, nextActionLabel: "Validar expediente", nextActionAt: new Date("2026-09-10T12:00:00.000Z"), websiteStatus: "no_website", websiteQuality: "not_analyzed" }, policy);
    expect(eligibility.eligible).toBe(true);
    expect(eligibility.reasons).toEqual([]);
  });

  it("explica los criterios pendientes y genera un expediente sin entrega externa activa", () => {
    const eligibility = evaluateHandoffEligibility({ status: "new", opportunityScore: 55, websiteStatus: "website_found", websiteQuality: "not_analyzed" }, policy);
    expect(eligibility.eligible).toBe(false);
    expect(eligibility.reasons).toHaveLength(4);
    const dossier = buildAuditDossier({ business: { name: "Ejemplo de validación", websiteStatus: "no_website" }, prospect: { id: 10, opportunityScore: 82, priority: "p1", scoreReasons: [], status: "contact_pending" }, eligibility: evaluateHandoffEligibility({ status: "contact_pending", opportunityScore: 82, nextActionLabel: "Validar expediente", nextActionAt: new Date("2026-09-10T12:00:00.000Z"), websiteStatus: "no_website" }, policy), analyses: [] });
    expect(dossier.externalDelivery.enabled).toBe(false);
    expect(dossier.purpose).toContain("revisión humana");
  });

  it("respeta una política operativa que relaja seguimiento o evidencia digital de forma explícita", () => {
    const eligibility = evaluateHandoffEligibility({ status: "contact_pending", opportunityScore: 54, websiteStatus: "website_found", websiteQuality: "not_analyzed" }, { minimumOpportunityScore: 50, requireNextAction: false, requireDigitalEvidence: false });
    expect(eligibility.eligible).toBe(true);
    expect(eligibility.criteria.minimumOpportunityScore).toBe(50);
  });
});

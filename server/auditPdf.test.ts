import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { buildAuditDossierPdf } from "./auditPdf";

describe("buildAuditDossierPdf", () => {
  it("genera un PDF válido con metadatos y un alcance sectorial verificable", async () => {
    const pdf = await buildAuditDossierPdf({
      business: { name: "Estudio Norte", category: "Arquitectura", city: "Lima", country: "Perú" },
      opportunity: { status: "qualified", priority: "p1", opportunityScore: 86 },
      readiness: {
        eligible: false,
        criteria: { score: 86, minimumOpportunityScore: 70, requireNextAction: true, hasNextAction: false, requireDigitalEvidence: true, hasDigitalEvidence: true },
        reasons: ["Falta registrar una próxima acción comercial con fecha."],
      },
      auditBrief: {
        executiveSummary: "Existe una oportunidad de mejorar la captación desde el sitio web.",
        recommendedEngagement: { title: "Mejora estratégica", rationale: "Hay señales verificables de mejora.", suggestedScope: ["Auditoría UX"] },
        customizedWebScope: { name: "Arquitectura", sector: "Servicios profesionales", overview: "Prioriza portafolio y solicitudes.", deliverables: ["Portafolio"], successMetrics: ["Consultas cualificadas"] },
        opportunitySignals: [{ signal: "Sitio web débil", contribution: 18 }],
        auditAgenda: ["Confirmar objetivos comerciales"],
        guardrails: ["Revisión humana obligatoria"],
      },
    });

    expect(pdf.length).toBeGreaterThan(500);
    expect(new TextDecoder().decode(pdf.slice(0, 5))).toBe("%PDF-");
    const parsed = await PDFDocument.load(pdf);
    expect(parsed.getPageCount()).toBeGreaterThan(0);
    expect(parsed.getTitle()).toContain("Estudio Norte");
    expect(parsed.getAuthor()).toBe("Nexo Local Opportunity Scanner");
  });
});

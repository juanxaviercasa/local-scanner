export type CommercialProspectStatus = "new" | "qualified" | "rejected" | "exported" | "analysis_pending" | "analyzed" | "demo_pending" | "contact_pending" | "contacted" | "converted" | "lost";

export type HandoffPolicyInput = {
  minimumOpportunityScore: number;
  requireNextAction: boolean;
  requireDigitalEvidence: boolean;
};

export type HandoffCandidate = {
  status: CommercialProspectStatus;
  opportunityScore: number;
  nextActionLabel?: string | null;
  nextActionAt?: Date | null;
  websiteStatus: "no_website" | "website_found" | "website_unreachable" | "website_unknown";
  websiteQuality?: "excellent" | "good" | "average" | "weak" | "very_weak" | "broken" | "not_analyzed" | null;
};

const eligibleStatuses: CommercialProspectStatus[] = ["qualified", "analysis_pending", "analyzed", "contact_pending", "contacted", "exported"];

export function evaluateHandoffEligibility(candidate: HandoffCandidate, policy: HandoffPolicyInput) {
  const reasons: string[] = [];
  if (candidate.opportunityScore < policy.minimumOpportunityScore) reasons.push(`El Opportunity Score es ${candidate.opportunityScore}; el mínimo configurado es ${policy.minimumOpportunityScore}.`);
  if (!eligibleStatuses.includes(candidate.status)) reasons.push("El prospecto aún no se encuentra en un estado comercial apto para auditoría.");
  if (policy.requireNextAction && (!candidate.nextActionLabel || !candidate.nextActionAt)) reasons.push("Falta registrar una próxima acción comercial con fecha.");
  const hasDigitalEvidence = candidate.websiteStatus === "no_website" || (candidate.websiteQuality && candidate.websiteQuality !== "not_analyzed");
  if (policy.requireDigitalEvidence && !hasDigitalEvidence) reasons.push("Falta una señal digital verificable: ausencia de sitio o análisis web registrado.");

  return {
    eligible: reasons.length === 0,
    reasons,
    criteria: {
      minimumOpportunityScore: policy.minimumOpportunityScore,
      requireNextAction: policy.requireNextAction,
      requireDigitalEvidence: policy.requireDigitalEvidence,
      score: candidate.opportunityScore,
      status: candidate.status,
      hasNextAction: Boolean(candidate.nextActionLabel && candidate.nextActionAt),
      hasDigitalEvidence: Boolean(hasDigitalEvidence),
    },
  };
}

export function buildAuditDossier(input: {
  business: { name: string; category?: string | null; city?: string | null; region?: string | null; country?: string | null; address?: string | null; phone?: string | null; website?: string | null; websiteStatus: string; websiteQuality?: string | null; websiteSignals?: Record<string, unknown> | null };
  prospect: { id: number; opportunityScore: number; priority: string; opportunityTypes?: string[] | null; scoreReasons: Array<{ label: string; points: number }>; analysisSummary?: string | null; nextActionLabel?: string | null; nextActionAt?: Date | null; status: string };
  eligibility: ReturnType<typeof evaluateHandoffEligibility>;
  analyses: Array<{ status: string; strategy: string; performanceScore?: number | null; accessibilityScore?: number | null; bestPracticesScore?: number | null; seoScore?: number | null; summary?: string | null; analyzedAt: Date }>;
}) {
  return {
    version: "1.0",
    generatedAt: new Date().toISOString(),
    purpose: "Expediente de auditoría web para la siguiente fase; requiere revisión humana antes de cualquier contacto o entrega externa.",
    business: input.business,
    opportunity: {
      id: input.prospect.id,
      status: input.prospect.status,
      opportunityScore: input.prospect.opportunityScore,
      priority: input.prospect.priority,
      opportunityTypes: input.prospect.opportunityTypes ?? [],
      scoreReasons: input.prospect.scoreReasons,
      analysisSummary: input.prospect.analysisSummary ?? null,
      nextAction: input.prospect.nextActionLabel && input.prospect.nextActionAt ? { label: input.prospect.nextActionLabel, at: input.prospect.nextActionAt.toISOString() } : null,
    },
    readiness: input.eligibility,
    websiteAnalyses: input.analyses.map(analysis => ({ ...analysis, analyzedAt: analysis.analyzedAt.toISOString() })),
    externalDelivery: { enabled: false, note: "El SaaS externo permanece como placeholder hasta que se configure y habilite explícitamente." },
  };
}

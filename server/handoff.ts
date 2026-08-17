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
  isDemo?: boolean;
};

const eligibleStatuses: CommercialProspectStatus[] = ["qualified", "analysis_pending", "analyzed", "contact_pending", "contacted", "exported"];

export function evaluateHandoffEligibility(candidate: HandoffCandidate, policy: HandoffPolicyInput) {
  const reasons: string[] = [];
  if (candidate.isDemo) reasons.push("Los datos de demostración están bloqueados para transición comercial y entrega externa.");
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
  const recommendation = input.business.websiteStatus === "no_website"
    ? {
      type: "new_website",
      title: "Creación de un sitio web orientado a conversión",
      rationale: "No se detectó un sitio web para el negocio; la siguiente fase puede definir una presencia digital propia, verificable y orientada a contacto.",
      suggestedScope: ["Descubrimiento de oferta, público y zona de servicio", "Arquitectura de páginas prioritarias", "Diseño responsive y accesible", "Canales de contacto y medición básica"],
    }
    : input.business.websiteStatus === "website_unreachable" || input.business.websiteQuality === "broken"
      ? {
        type: "website_recovery",
        title: "Recuperación y modernización del sitio web",
        rationale: "El sitio no respondió o presenta una señal técnica crítica; la auditoría debe confirmar la causa antes de plantear una mejora.",
        suggestedScope: ["Diagnóstico técnico y de accesibilidad", "Priorización de recuperación", "Rediseño de páginas de contacto", "Plan de medición posterior"],
      }
      : {
        type: "website_improvement",
        title: "Mejora estratégica del sitio web existente",
        rationale: "Existe una presencia web detectable; la auditoría debe contrastar las señales disponibles con los objetivos comerciales antes de recomendar cambios.",
        suggestedScope: ["Auditoría de experiencia y conversión", "Revisión de contenidos y llamadas a la acción", "Mejoras de rendimiento y accesibilidad", "Priorización de entregables"],
      };
  const opportunitySignals = input.prospect.scoreReasons.map(reason => ({ signal: reason.label, contribution: reason.points }));
  return {
    version: "2.0",
    generatedAt: new Date().toISOString(),
    purpose: "Expediente de auditoría web para la siguiente fase; requiere revisión humana antes de cualquier contacto, propuesta o entrega externa.",
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
    auditBrief: {
      executiveSummary: `Oportunidad ${input.prospect.priority.toUpperCase()} con Opportunity Score ${input.prospect.opportunityScore}/100. El expediente organiza únicamente señales verificables para que la siguiente fase decida el alcance de una creación o mejora web.`,
      recommendedEngagement: recommendation,
      opportunitySignals,
      auditAgenda: [
        "Confirmar objetivos comerciales, oferta principal y zona de servicio con el negocio.",
        "Validar la presencia digital real y las señales incluidas en este expediente.",
        "Priorizar un alcance web que responda a las oportunidades verificadas, sin asumir datos no analizados.",
        "Definir entregables, responsables, calendario y medición antes de iniciar la implementación.",
      ],
      receivingSaasChecklist: [
        "Revisar los criterios de aptitud y las razones del Opportunity Score.",
        "Comprobar el análisis web disponible y los datos de contacto autorizados.",
        "Solicitar confirmación humana antes de crear una propuesta, contacto o proyecto.",
        "Devolver el resultado de la auditoría al equipo comercial mediante un canal autorizado.",
      ],
      guardrails: [
        "Este expediente no autoriza contacto automático ni generación automática de un sitio web.",
        "Los datos de demostración y las señales no verificadas no pueden pasar a la siguiente fase.",
        "La recomendación es un punto de partida para auditoría; no sustituye la revisión profesional.",
      ],
    },
    externalDelivery: { enabled: false, note: "El SaaS externo permanece como placeholder hasta que se configure y habilite explícitamente." },
  };
}

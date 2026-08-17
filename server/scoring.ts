export type ScoreReason = { label: string; points: number };

export type BusinessSignals = {
  rating?: number | null;
  reviewCount?: number | null;
  websiteStatus: "no_website" | "website_found" | "website_unreachable" | "website_unknown";
  websiteQuality?: "excellent" | "good" | "average" | "weak" | "very_weak" | "broken" | "not_analyzed" | null;
  hasPhone: boolean;
  hasBooking: boolean;
  hasWhatsapp: boolean;
  commercialPotential: "low" | "medium" | "high" | "very_high";
};

export type OpportunityScore = {
  opportunityScore: number;
  businessAttractivenessScore: number;
  digitalOpportunityScore: number;
  websiteOpportunityScore: number;
  leadPotentialScore: number;
  commercialPotentialScore: number;
  urgencyScore: number;
  priority: "p0" | "p1" | "p2" | "p3" | "ignore";
  opportunityTypes: string[];
  reasons: ScoreReason[];
  summary: string;
};

export const DEFAULT_SCORING_WEIGHTS = {
  noWebsite: 25,
  unreachableWebsite: 18,
  weakWebsite: 14,
  strongReviewBase: 12,
  strongReviewBonus: 8,
  strongRating: 10,
  commercialPotential: 14,
  noBooking: 6,
  noWhatsapp: 4,
  hasPhone: 3,
};

export const DEFAULT_SCORING_THRESHOLDS = {
  goodRating: 4.5,
  minimumRating: 3.7,
  strongReviews: 100,
  exceptionalReviews: 500,
  p0: 85,
  p1: 70,
  p2: 50,
  p3: 30,
};

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

function priorityFor(score: number, thresholds: Record<string, number>): OpportunityScore["priority"] {
  if (score >= (thresholds.p0 ?? DEFAULT_SCORING_THRESHOLDS.p0)) return "p0";
  if (score >= (thresholds.p1 ?? DEFAULT_SCORING_THRESHOLDS.p1)) return "p1";
  if (score >= (thresholds.p2 ?? DEFAULT_SCORING_THRESHOLDS.p2)) return "p2";
  if (score >= (thresholds.p3 ?? DEFAULT_SCORING_THRESHOLDS.p3)) return "p3";
  return "ignore";
}

/**
 * Calcula una señal comercial explicable exclusivamente a partir de campos
 * verificados por el proveedor o del análisis de sitio ya realizado.
 */
export function scoreBusiness(
  signals: BusinessSignals,
  weights: Record<string, number> = DEFAULT_SCORING_WEIGHTS,
  thresholds: Record<string, number> = DEFAULT_SCORING_THRESHOLDS
): OpportunityScore {
  const reason = (label: string, points: number, list: ScoreReason[]) => {
    if (points) list.push({ label, points });
    return points;
  };
  const reasons: ScoreReason[] = [];
  const opportunityTypes = new Set<string>();
  const reviewCount = signals.reviewCount ?? 0;
  const rating = signals.rating ?? 0;

  let businessAttractiveness = 0;
  if (reviewCount >= (thresholds.strongReviews ?? 100)) {
    businessAttractiveness += reason(`${reviewCount}+ reseñas verificadas`, weights.strongReviewBase ?? 12, reasons);
  }
  if (reviewCount >= (thresholds.exceptionalReviews ?? 500)) {
    businessAttractiveness += reason("Volumen de reseñas especialmente alto", weights.strongReviewBonus ?? 8, reasons);
  }
  if (rating >= (thresholds.goodRating ?? 4.5)) {
    businessAttractiveness += reason(`Valoración de ${rating.toFixed(1)} o superior`, weights.strongRating ?? 10, reasons);
  } else if (rating > 0 && rating < (thresholds.minimumRating ?? 3.7)) {
    businessAttractiveness -= reason("Valoración inferior al umbral comercial", -10, reasons);
  }

  const commercialMap = { low: 2, medium: 6, high: 10, very_high: weights.commercialPotential ?? 14 };
  const commercialPotential = commercialMap[signals.commercialPotential];
  if (commercialPotential) businessAttractiveness += reason("Categoría con potencial comercial configurado", commercialPotential, reasons);

  let websiteOpportunity = 0;
  if (signals.websiteStatus === "no_website") {
    websiteOpportunity += reason("No se encontró sitio web propio", weights.noWebsite ?? 25, reasons);
    opportunityTypes.add("CREAR SITIO WEB");
    opportunityTypes.add("MEJORAR PRESENCIA DIGITAL");
  } else if (signals.websiteStatus === "website_unreachable") {
    websiteOpportunity += reason("El sitio web no respondió durante la comprobación", weights.unreachableWebsite ?? 18, reasons);
    opportunityTypes.add("REDISEÑAR SITIO WEB");
  } else if (["weak", "very_weak", "broken"].includes(signals.websiteQuality ?? "")) {
    websiteOpportunity += reason("El análisis disponible indica un sitio web mejorable", weights.weakWebsite ?? 14, reasons);
    opportunityTypes.add("REDISEÑAR SITIO WEB");
    opportunityTypes.add("MEJORAR CONVERSIÓN");
  }

  let digitalOpportunity = websiteOpportunity;
  if (!signals.hasBooking) {
    digitalOpportunity += reason("No se detectó un canal de reserva", weights.noBooking ?? 6, reasons);
    opportunityTypes.add("IMPLEMENTAR RESERVAS");
  }
  if (!signals.hasWhatsapp) {
    digitalOpportunity += reason("No se detectó un canal de WhatsApp", weights.noWhatsapp ?? 4, reasons);
    opportunityTypes.add("IMPLEMENTAR WHATSAPP");
  }
  if (signals.hasPhone) businessAttractiveness += reason("Teléfono empresarial disponible", weights.hasPhone ?? 3, reasons);

  const commercialPotentialScore = clamp(commercialPotential * 7);
  const leadPotentialScore = clamp(businessAttractiveness * 2.7 + (signals.hasPhone ? 8 : 0));
  const urgencyScore = clamp(websiteOpportunity * 2.5 + (!signals.hasBooking ? 10 : 0));
  const opportunityScore = clamp(businessAttractiveness + digitalOpportunity + commercialPotentialScore * 0.25 + leadPotentialScore * 0.15);
  const priority = priorityFor(opportunityScore, thresholds);
  const nameForSummary = signals.websiteStatus === "no_website" ? "sin sitio web propio" : "con señales de mejora digital";
  const opportunityTypeList = Array.from(opportunityTypes);
  const summary = `Negocio ${nameForSummary}, con ${reviewCount ? `${reviewCount} reseñas` : "actividad pública disponible"}${rating ? ` y valoración ${rating.toFixed(1)}` : ""}. ${opportunityTypes.size ? `La oportunidad principal es ${opportunityTypeList[0]?.toLowerCase()}.` : "No hay una oportunidad digital concluyente con los datos disponibles."}`;

  return {
    opportunityScore,
    businessAttractivenessScore: clamp(businessAttractiveness * 3),
    digitalOpportunityScore: clamp(digitalOpportunity * 3),
    websiteOpportunityScore: clamp(websiteOpportunity * 4),
    leadPotentialScore,
    commercialPotentialScore,
    urgencyScore,
    priority,
    opportunityTypes: opportunityTypeList,
    reasons,
    summary,
  };
}

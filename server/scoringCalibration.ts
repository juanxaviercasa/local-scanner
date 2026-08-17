import { DEFAULT_SCORING_THRESHOLDS, DEFAULT_SCORING_WEIGHTS } from "./scoring";

export type CalibrationOutcome = "won" | "lost";

export type CalibrationRow = {
  outcome: CalibrationOutcome;
  noWebsite?: boolean | null;
  weakWebsite?: boolean | null;
  reviewCount?: number | null;
  rating?: number | null;
  hasPhone?: boolean | null;
  hasBooking?: boolean | null;
  hasWhatsapp?: boolean | null;
  commercialPotential?: "low" | "medium" | "high" | "very_high" | null;
};

type CalibrationFactor = { key: keyof typeof DEFAULT_SCORING_WEIGHTS; label: string; evidence: (row: CalibrationRow) => boolean | undefined };

const bounded = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const positiveRate = (rows: CalibrationRow[]) => rows.length ? rows.filter(row => row.outcome === "won").length / rows.length : 0;

export function calibrateScoringWeights(
  rows: CalibrationRow[],
  currentWeights: Record<string, number> = DEFAULT_SCORING_WEIGHTS,
  thresholds: Record<string, number> = DEFAULT_SCORING_THRESHOLDS
) {
  if (rows.length < 8) throw new Error("Incluye al menos 8 resultados comerciales etiquetados como ganado o perdido para calibrar el puntaje.");

  const factors: CalibrationFactor[] = [
    { key: "noWebsite", label: "Sin sitio web", evidence: row => row.noWebsite === null || row.noWebsite === undefined ? undefined : row.noWebsite },
    { key: "unreachableWebsite", label: "Sitio no disponible", evidence: () => undefined },
    { key: "weakWebsite", label: "Sitio web débil", evidence: row => row.weakWebsite === null || row.weakWebsite === undefined ? undefined : row.weakWebsite },
    { key: "strongReviewBase", label: "Reseñas relevantes", evidence: row => row.reviewCount === null || row.reviewCount === undefined ? undefined : row.reviewCount >= (thresholds.strongReviews ?? 100) },
    { key: "strongReviewBonus", label: "Reseñas excepcionales", evidence: row => row.reviewCount === null || row.reviewCount === undefined ? undefined : row.reviewCount >= (thresholds.exceptionalReviews ?? 500) },
    { key: "strongRating", label: "Valoración alta", evidence: row => row.rating === null || row.rating === undefined ? undefined : row.rating >= (thresholds.goodRating ?? 4.5) },
    { key: "commercialPotential", label: "Alto potencial comercial", evidence: row => row.commercialPotential ? ["high", "very_high"].includes(row.commercialPotential) : undefined },
    { key: "noBooking", label: "Sin canal de reservas", evidence: row => row.hasBooking === null || row.hasBooking === undefined ? undefined : !row.hasBooking },
    { key: "noWhatsapp", label: "Sin WhatsApp", evidence: row => row.hasWhatsapp === null || row.hasWhatsapp === undefined ? undefined : !row.hasWhatsapp },
    { key: "hasPhone", label: "Teléfono disponible", evidence: row => row.hasPhone === null || row.hasPhone === undefined ? undefined : row.hasPhone },
  ];

  const baseline = positiveRate(rows);
  const recommendedWeights: Record<string, number> = { ...currentWeights };
  const explanations: Array<{ key: string; label: string; matchedRows: number; conversionRate: number; lift: number; recommendedWeight: number }> = [];

  for (const factor of factors) {
    const observed = rows.map(row => ({ row, evidence: factor.evidence(row) })).filter((item): item is { row: CalibrationRow; evidence: boolean } => item.evidence !== undefined);
    const positives = observed.filter(item => item.evidence).map(item => item.row);
    const negatives = observed.filter(item => !item.evidence).map(item => item.row);
    if (positives.length < 3 || negatives.length < 3) continue;

    const rate = positiveRate(positives);
    const lift = rate - baseline;
    const baseWeight = currentWeights[factor.key] ?? DEFAULT_SCORING_WEIGHTS[factor.key];
    const recommendedWeight = Math.round(baseWeight * bounded(1 + lift * 2, 0.4, 1.6));
    recommendedWeights[factor.key] = recommendedWeight;
    explanations.push({ key: factor.key, label: factor.label, matchedRows: positives.length, conversionRate: rate, lift, recommendedWeight });
  }

  if (!explanations.length) throw new Error("El CSV tiene resultados, pero no incluye suficientes señales comparables. Añade al menos una señal con tres casos positivos y tres negativos.");

  const won = rows.filter(row => row.outcome === "won").length;
  return { validRows: rows.length, won, lost: rows.length - won, conversionRate: baseline, stableFactors: explanations.length, recommendedWeights, explanations };
}

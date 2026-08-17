export type ScannerBudget = {
  dailyRequestBudget: number;
  monthlyRequestBudget: number;
  maxCostPerRunCents: number;
  maxBusinessesPerRun: number;
};

export type ScannerUsage = {
  dailyRequests: number;
  monthlyRequests: number;
};

const PROVIDER_PAGE_CAP = 20;

export function getConfiguredCostPerOperationCents() {
  const configured = Number(process.env.NEXO_GOOGLE_PLACES_ESTIMATED_COST_CENTS ?? 0);
  return Number.isFinite(configured) && configured >= 0 ? configured : 0;
}

export function calculateProspectingPlan(
  input: { maxResults: number },
  budget: ScannerBudget,
  usage: ScannerUsage,
  costPerOperationCents: number
) {
  const requested = Math.min(input.maxResults, budget.maxBusinessesPerRun, PROVIDER_PAGE_CAP);
  const estimatedOperations = 2 + requested;
  const estimatedCostCents = estimatedOperations * costPerOperationCents;
  const reasons: string[] = [];
  if (input.maxResults > budget.maxBusinessesPerRun) reasons.push(`La configuración permite un máximo de ${budget.maxBusinessesPerRun} negocios por prospección.`);
  if (usage.dailyRequests + estimatedOperations > budget.dailyRequestBudget) reasons.push("La ejecución supera el presupuesto diario de solicitudes.");
  if (usage.monthlyRequests + estimatedOperations > budget.monthlyRequestBudget) reasons.push("La ejecución supera el presupuesto mensual de solicitudes.");
  if (estimatedCostCents > budget.maxCostPerRunCents) reasons.push("El coste estimado supera el máximo permitido por prospección.");
  return { requested, estimatedOperations, estimatedCostCents, allowed: reasons.length === 0, reasons };
}

export function actualUsageStaysWithinPlan(
  actualOperations: number,
  actualCostCents: number,
  plan: { estimatedOperations: number },
  budget: Pick<ScannerBudget, "maxCostPerRunCents">
) {
  return actualOperations <= plan.estimatedOperations && actualCostCents <= budget.maxCostPerRunCents;
}

function safeCsvValue(value: unknown) {
  const serialized = value === undefined || value === null ? "" : typeof value === "string" ? value : JSON.stringify(value);
  const formulaSafe = /^[=+\-@]/.test(serialized) ? `'${serialized}` : serialized;
  return `"${formulaSafe.replace(/"/g, '""')}"`;
}

export function buildCsvDocument(rows: Array<Record<string, unknown>>) {
  const headers = Object.keys(rows[0] ?? { lead_id: "" });
  return [headers.join(","), ...rows.map(row => headers.map(header => safeCsvValue(row[header])).join(","))].join("\n");
}

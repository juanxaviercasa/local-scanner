export function getValidationDemoImport() {
  return {
    source: "manual_entry" as const,
    country: "Demostración",
    city: "Entorno local",
    primaryCategory: "Ejemplo de validación",
    keywords: [] as string[],
    excludedKeywords: [] as string[],
    radiusMeters: 500,
    maxResults: 1,
    minReviewCount: 0,
    minOpportunityScore: 0,
    websiteMode: "both" as const,
    records: [{
      name: "NEGOCIO DE DEMOSTRACIÓN — VALIDACIÓN LOCAL",
      category: "Ejemplo de validación",
      city: "Entorno local",
      country: "Demostración",
      address: "Dato sintético; no usar comercialmente",
      phone: null,
      website: null,
      rating: null,
      reviewCount: null,
      isDemo: true,
    }],
  };
}

type DemoProspect = {
  prospect: { id: number; status: string };
  business: { name: string };
};

type DemoValidationDependencies = {
  listProspects: (ownerId: number, filters: { query?: string; runId?: number; limit?: number }) => Promise<DemoProspect[]>;
  importBusinesses: (ownerId: number, input: ReturnType<typeof getValidationDemoImport>) => Promise<{ id: number } | undefined>;
  updateRunProspect: (ownerId: number, prospectId: number, changes: { status: "contact_pending"; nextActionLabel: string; nextActionAt: Date }) => Promise<unknown>;
  createProspectActivity: (input: { ownerId: number; prospectId: number; action: string; note: string; previousStatus: string; nextStatus: "contact_pending"; nextActionLabel: string; nextActionAt: Date }) => Promise<unknown>;
  now?: () => Date;
};

const DEMO_NAME = "NEGOCIO DE DEMOSTRACIÓN — VALIDACIÓN LOCAL";
const DEMO_ACTION = "Revisar el flujo de demostración";

export async function createValidationDemo(ownerId: number, dependencies: DemoValidationDependencies) {
  const existing = (await dependencies.listProspects(ownerId, { query: DEMO_NAME, limit: 20 })).find(item => item.business.name === DEMO_NAME);
  if (existing) return { prospectId: existing.prospect.id, created: false };

  const run = await dependencies.importBusinesses(ownerId, getValidationDemoImport());
  const prospect = (await dependencies.listProspects(ownerId, { runId: run?.id, limit: 5 }))[0];
  if (!prospect) throw new Error("No se pudo crear el prospecto de demostración.");

  const dueAt = new Date((dependencies.now?.() ?? new Date()).getTime() + 72 * 60 * 60 * 1000);
  await dependencies.updateRunProspect(ownerId, prospect.prospect.id, { status: "contact_pending", nextActionLabel: DEMO_ACTION, nextActionAt: dueAt });
  await dependencies.createProspectActivity({
    ownerId,
    prospectId: prospect.prospect.id,
    action: "follow_up_scheduled",
    note: "Ejemplo de validación con datos sintéticos; no representa un negocio real ni debe usarse comercialmente.",
    previousStatus: prospect.prospect.status,
    nextStatus: "contact_pending",
    nextActionLabel: DEMO_ACTION,
    nextActionAt: dueAt,
  });
  return { prospectId: prospect.prospect.id, created: true };
}

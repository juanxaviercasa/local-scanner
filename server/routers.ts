import { TRPCError } from "@trpc/server";
import { nanoid } from "nanoid";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import {
  createRawSearchResult,
  createRunEvent,
  createRunProspect,
  createProspectingRun,
  createSearchProfile,
  createUsageRecord,
  getOrCreateBudgetSettings,
  getOrCreateDefaultScoringProfile,
  getProspect,
  getProspectingRun,
  getScannerDashboard,
  getUsageSummary,
  listProspectingRuns,
  listProspects,
  listRunEvents,
  listScoringProfiles,
  listSearchProfiles,
  listUsers,
  updateBudgetSettings,
  updateRunProspect,
  updateScoringProfile,
  updateUserProfile,
  updateUserRole,
  updateProspectingRun,
  upsertBusinessFromProvider,
} from "./db";
import { buildProviderQuery, findGoogleBusinesses, type SearchPlan } from "./googlePlacesProvider";
import { DEFAULT_SCORING_THRESHOLDS, DEFAULT_SCORING_WEIGHTS, scoreBusiness } from "./scoring";

const websiteStatusSchema = z.enum(["no_website", "website_found", "website_unreachable", "website_unknown"]);
const prioritySchema = z.enum(["p0", "p1", "p2", "p3", "ignore"]);
const prospectStatusSchema = z.enum(["new", "qualified", "rejected", "exported", "analysis_pending", "analyzed", "demo_pending", "contact_pending", "contacted", "converted", "lost"]);
const runStatusSchema = z.enum(["queued", "running", "paused", "completed", "partial", "failed", "cancelled"]);

const searchInput = z.object({
  country: z.string().trim().min(2).max(80),
  city: z.string().trim().min(2).max(120),
  district: z.string().trim().max(120).nullable().optional(),
  referenceAddress: z.string().trim().max(300).nullable().optional(),
  primaryCategory: z.string().trim().min(2).max(120),
  keywords: z.array(z.string().trim().min(1).max(80)).max(8).default([]),
  excludedKeywords: z.array(z.string().trim().min(1).max(80)).max(8).default([]),
  radiusMeters: z.number().int().min(100).max(50000).default(5000),
  maxResults: z.number().int().min(1).max(50).default(20),
  minRating: z.number().min(0).max(5).nullable().optional(),
  minReviewCount: z.number().int().min(0).max(1000000).default(0),
  minOpportunityScore: z.number().int().min(0).max(100).default(0),
  websiteMode: z.enum(["no_website", "with_website", "both"]).default("both"),
});

type SearchInput = z.infer<typeof searchInput>;

function asNumberRecord(value: unknown, fallback: Record<string, number>) {
  if (!value || typeof value !== "object") return fallback;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).filter(([, item]) => typeof item === "number")) as Record<string, number>;
}

function providerCostPerOperationCents() {
  const configured = Number(process.env.NEXO_GOOGLE_PLACES_ESTIMATED_COST_CENTS ?? 0);
  return Number.isFinite(configured) && configured >= 0 ? configured : 0;
}

function planCosts(input: SearchInput, budget: Awaited<ReturnType<typeof getOrCreateBudgetSettings>>, usage: Awaited<ReturnType<typeof getUsageSummary>>) {
  // El proveedor devuelve una página de hasta 20 resultados en esta versión del flujo.
  // Limitar aquí evita prometer un volumen superior al que se consultará realmente.
  const requested = Math.min(input.maxResults, budget.maxBusinessesPerRun, 20);
  const estimatedOperations = 2 + requested; // geocoding + search + one detail request per candidate
  const estimatedCostCents = estimatedOperations * providerCostPerOperationCents();
  const reasons: string[] = [];
  if (input.maxResults > budget.maxBusinessesPerRun) reasons.push(`La configuración permite un máximo de ${budget.maxBusinessesPerRun} negocios por prospección.`);
  if (usage.dailyRequests + estimatedOperations > budget.dailyRequestBudget) reasons.push("La ejecución supera el presupuesto diario de solicitudes.");
  if (usage.monthlyRequests + estimatedOperations > budget.monthlyRequestBudget) reasons.push("La ejecución supera el presupuesto mensual de solicitudes.");
  if (estimatedCostCents > budget.maxCostPerRunCents) reasons.push("El coste estimado supera el máximo permitido por prospección.");
  return { requested, estimatedOperations, estimatedCostCents, allowed: reasons.length === 0, reasons };
}

function domainFromUrl(value?: string) {
  if (!value) return null;
  try { return new URL(value).hostname.replace(/^www\./, "").toLowerCase(); } catch { return null; }
}

function dataQualityOf(business: { address?: string; phone?: string; website?: string; rating?: number; reviewCount?: number }) {
  return [business.address, business.phone, business.website, business.rating !== undefined, business.reviewCount !== undefined].filter(Boolean).length * 20;
}

function csvSafe(value: unknown) {
  const text = value === undefined || value === null ? "" : typeof value === "string" ? value : JSON.stringify(value);
  return `"${text.replace(/"/g, '""')}"`;
}

async function executeRun(ownerId: number, input: SearchInput) {
  const budget = await getOrCreateBudgetSettings(ownerId);
  const usage = await getUsageSummary(ownerId);
  const plan = planCosts(input, budget, usage);
  if (!plan.allowed) throw new TRPCError({ code: "PRECONDITION_FAILED", message: plan.reasons.join(" ") });
  const scoring = await getOrCreateDefaultScoringProfile(ownerId);
  const weights = asNumberRecord(scoring.weights, DEFAULT_SCORING_WEIGHTS);
  const thresholds = asNumberRecord(scoring.thresholds, DEFAULT_SCORING_THRESHOLDS);
  const query = buildProviderQuery({ country: input.country, city: input.city, district: input.district, referenceAddress: input.referenceAddress, category: input.primaryCategory, keywords: input.keywords, radiusMeters: input.radiusMeters, maxResults: plan.requested });
  const run = await createProspectingRun({
    ownerId, publicId: `RUN-${nanoid(8).toUpperCase()}`, query, country: input.country, city: input.city, district: input.district ?? null, referenceAddress: input.referenceAddress ?? null,
    radiusMeters: input.radiusMeters, primaryCategory: input.primaryCategory, keywords: input.keywords, excludedKeywords: input.excludedKeywords, websiteMode: input.websiteMode,
    maxResults: plan.requested, minRating: input.minRating ?? null, minReviewCount: input.minReviewCount, minOpportunityScore: input.minOpportunityScore, scoringSnapshot: { ...weights, ...thresholds },
    estimatedOperations: plan.estimatedOperations, estimatedCostCents: plan.estimatedCostCents,
  });
  await updateProspectingRun(run.id, ownerId, { status: "running", startedAt: new Date() });
  await createRunEvent({ runId: run.id, stage: "plan", message: `Plan confirmado: ${plan.requested} negocios como máximo y ${plan.estimatedOperations} operaciones estimadas.` });
  await createRunEvent({ runId: run.id, stage: "budget", message: `Presupuesto validado antes de consultar: ${usage.dailyRequests}/${budget.dailyRequestBudget} solicitudes diarias y ${usage.monthlyRequests}/${budget.monthlyRequestBudget} mensuales usadas.` });

  let processed = 0;
  let qualified = 0;
  try {
    const providerPlan: SearchPlan = { country: input.country, city: input.city, district: input.district, referenceAddress: input.referenceAddress, category: input.primaryCategory, keywords: input.keywords, radiusMeters: input.radiusMeters, maxResults: plan.requested };
    const response = await findGoogleBusinesses(providerPlan);
    await createUsageRecord({ ownerId, runId: run.id, provider: "google_maps", operation: "places_search_and_details", requestCount: response.operations, estimatedCostCents: response.operations * providerCostPerOperationCents() });
    await createRunEvent({ runId: run.id, stage: "search", message: `La fuente autorizada devolvió ${response.businesses.length} resultados.` });
    await createRunEvent({ runId: run.id, stage: "details", message: `Se recibieron ${response.operations} operaciones de búsqueda y detalle desde el proveedor autorizado.` });

    const actualCostCents = response.operations * providerCostPerOperationCents();
    if (response.operations > plan.estimatedOperations || actualCostCents > budget.maxCostPerRunCents) {
      await createRunEvent({
        runId: run.id,
        stage: "budget",
        level: "error",
        recoverable: 1,
        errorCode: "ACTUAL_USAGE_EXCEEDED_PLAN",
        message: "El consumo real excedió el plan autorizado; el procesamiento posterior se detuvo para preservar el presupuesto.",
      });
      await updateProspectingRun(run.id, ownerId, { status: "partial", foundCount: response.businesses.length, errorCount: 1, finishedAt: new Date() });
      return getProspectingRun(run.id, ownerId);
    }

    const unique = new Map(response.businesses.map(item => [item.externalId, item]));
    await createRunEvent({ runId: run.id, stage: "normalize", message: "Se inició la normalización de campos públicos recibidos desde la fuente." });
    await createRunEvent({ runId: run.id, stage: "deduplicate", message: `${response.businesses.length - unique.size} registros repetidos se descartaron usando la identidad de la fuente.` });
    for (const item of Array.from(unique.values())) {
      await createRawSearchResult({ runId: run.id, provider: "google_maps", providerRecordId: item.externalId, query, payload: item.sourcePayload });
      const websiteStatus = item.website ? "website_found" : "no_website";
      if (input.websiteMode === "no_website" && websiteStatus !== "no_website") continue;
      if (input.websiteMode === "with_website" && websiteStatus !== "website_found") continue;
      if (input.minRating !== null && input.minRating !== undefined && (item.rating ?? 0) < input.minRating) continue;
      if ((item.reviewCount ?? 0) < input.minReviewCount) continue;
      const saved = await upsertBusinessFromProvider({
        ownerId, source: "google_maps", externalId: item.externalId, deduplicationKey: `google_maps:${item.externalId}`, name: item.name,
        category: item.categories[0] ?? input.primaryCategory, categories: item.categories, address: item.address ?? null, city: input.city, country: input.country,
        latitude: item.latitude ?? null, longitude: item.longitude ?? null, phone: item.phone ?? null, website: item.website ?? null, domain: domainFromUrl(item.website),
        googleMapsUrl: item.googleMapsUrl, rating: item.rating ?? null, reviewCount: item.reviewCount ?? null, businessStatus: item.businessStatus ?? null, websiteStatus,
        dataQualityScore: dataQualityOf(item),
      });
      const evaluated = scoreBusiness({ rating: item.rating, reviewCount: item.reviewCount, websiteStatus, websiteQuality: "not_analyzed", hasPhone: Boolean(item.phone), hasBooking: false, hasWhatsapp: false, commercialPotential: "medium" }, weights, thresholds);
      const status = evaluated.opportunityScore >= input.minOpportunityScore ? "qualified" : "rejected";
      await createRunProspect({ runId: run.id, businessId: saved.business.id, duplicateConfidence: saved.isKnown ? "exact" : "high", status, ...evaluated, scoreReasons: evaluated.reasons, analysisSummary: evaluated.summary });
      processed += 1;
      if (status === "qualified") qualified += 1;
    }
    await updateProspectingRun(run.id, ownerId, { status: "completed", foundCount: response.businesses.length, uniqueCount: unique.size, qualifiedCount: qualified, rejectedCount: processed - qualified, finishedAt: new Date() });
    await createRunEvent({ runId: run.id, stage: "score", message: `${processed} negocios se conservaron y puntuaron; ${qualified} superaron el umbral.` });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error no identificado del proveedor.";
    await updateProspectingRun(run.id, ownerId, { status: processed ? "partial" : "failed", uniqueCount: processed, qualifiedCount: qualified, rejectedCount: Math.max(0, processed - qualified), errorCount: 1, finishedAt: new Date() });
    await createRunEvent({ runId: run.id, stage: "search", level: "error", message: `La ejecución se detuvo: ${message}`, errorCode: "PROVIDER_OR_PROCESSING_ERROR", recoverable: 1 });
  }
  return getProspectingRun(run.id, ownerId);
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const options = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...options, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  dashboard: router({
    metrics: protectedProcedure.query(({ ctx }) => getScannerDashboard(ctx.user.id)),
    recentRuns: protectedProcedure.query(({ ctx }) => listProspectingRuns(ctx.user.id, 6)),
  }),
  integrations: router({
    status: protectedProcedure.query(() => ({
      googleMaps: { configured: Boolean(process.env.BUILT_IN_FORGE_API_KEY && process.env.BUILT_IN_FORGE_API_URL), mode: "official_proxy" as const },
      googleSheets: { configured: Boolean(process.env.NEXO_GOOGLE_SHEETS_WEBHOOK_URL), mode: "placeholder" as const },
      websiteAnalyzer: { configured: Boolean(process.env.NEXO_WEBSITE_ANALYZER_URL), mode: "placeholder" as const },
    })),
  }),
  settings: router({
    budget: protectedProcedure.query(({ ctx }) => getOrCreateBudgetSettings(ctx.user.id)),
    updateBudget: protectedProcedure.input(z.object({ dailyRequestBudget: z.number().int().min(1).max(100000).optional(), monthlyRequestBudget: z.number().int().min(1).max(1000000).optional(), maxCostPerRunCents: z.number().int().min(0).max(10000000).optional(), maxBusinessesPerRun: z.number().int().min(1).max(50).optional(), maxAiCallsPerRun: z.number().int().min(0).max(1000).optional() })).mutation(({ ctx, input }) => updateBudgetSettings(ctx.user.id, input)),
    scoringProfiles: protectedProcedure.query(({ ctx }) => listScoringProfiles(ctx.user.id)),
    updateScoring: protectedProcedure.input(z.object({ profileId: z.number().int().positive(), name: z.string().trim().min(2).max(120).optional(), weights: z.record(z.string(), z.number().min(-100).max(100)).optional(), thresholds: z.record(z.string(), z.number().min(0).max(100)).optional() })).mutation(({ ctx, input }) => { const { profileId, ...data } = input; return updateScoringProfile(ctx.user.id, profileId, data); }),
  }),
  searchProfiles: router({
    list: protectedProcedure.query(({ ctx }) => listSearchProfiles(ctx.user.id)),
    create: protectedProcedure.input(searchInput.extend({ name: z.string().trim().min(2).max(120) })).mutation(({ ctx, input }) => {
      const { name, ...profile } = input;
      return createSearchProfile(ctx.user.id, { name, ...profile });
    }),
  }),
  runs: router({
    plan: protectedProcedure.input(searchInput).query(async ({ ctx, input }) => {
      const [budget, usage, scoring] = await Promise.all([getOrCreateBudgetSettings(ctx.user.id), getUsageSummary(ctx.user.id), getOrCreateDefaultScoringProfile(ctx.user.id)]);
      return { query: buildProviderQuery({ country: input.country, city: input.city, district: input.district, referenceAddress: input.referenceAddress, category: input.primaryCategory, keywords: input.keywords, radiusMeters: input.radiusMeters, maxResults: input.maxResults }), plan: planCosts(input, budget, usage), budget, usage, scoringProfile: { id: scoring.id, name: scoring.name } };
    }),
    execute: protectedProcedure.input(searchInput.extend({ confirmed: z.literal(true) })).mutation(({ ctx, input }) => executeRun(ctx.user.id, input)),
    list: protectedProcedure.input(z.object({ limit: z.number().int().min(1).max(100).optional() }).optional()).query(({ ctx, input }) => listProspectingRuns(ctx.user.id, input?.limit ?? 30)),
    get: protectedProcedure.input(z.object({ runId: z.number().int().positive() })).query(async ({ ctx, input }) => {
      const run = await getProspectingRun(input.runId, ctx.user.id);
      if (!run) throw new TRPCError({ code: "NOT_FOUND", message: "No se encontró la prospección." });
      return run;
    }),
    events: protectedProcedure.input(z.object({ runId: z.number().int().positive() })).query(async ({ ctx, input }) => {
      const run = await getProspectingRun(input.runId, ctx.user.id);
      if (!run) throw new TRPCError({ code: "NOT_FOUND", message: "No se encontró la prospección." });
      return listRunEvents(input.runId);
    }),
    cancel: protectedProcedure.input(z.object({ runId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const run = await getProspectingRun(input.runId, ctx.user.id);
      if (!run) throw new TRPCError({ code: "NOT_FOUND", message: "No se encontró la prospección." });
      return updateProspectingRun(input.runId, ctx.user.id, { status: "cancelled", finishedAt: new Date() });
    }),
    filterByStatus: protectedProcedure.input(z.object({ status: runStatusSchema })).query(({ ctx, input }) => listProspectingRuns(ctx.user.id, 100).then(rows => rows.filter(row => row.status === input.status))),
  }),
  prospects: router({
    list: protectedProcedure.input(z.object({ runId: z.number().int().positive().optional(), priority: prioritySchema.optional(), websiteStatus: websiteStatusSchema.optional(), minimumScore: z.number().int().min(0).max(100).optional(), query: z.string().trim().max(160).optional(), limit: z.number().int().min(1).max(500).optional() }).optional()).query(({ ctx, input }) => listProspects(ctx.user.id, input)),
    get: protectedProcedure.input(z.object({ prospectId: z.number().int().positive() })).query(async ({ ctx, input }) => {
      const value = await getProspect(ctx.user.id, input.prospectId);
      if (!value) throw new TRPCError({ code: "NOT_FOUND", message: "No se encontró el prospecto." });
      return value;
    }),
    update: protectedProcedure.input(z.object({ prospectId: z.number().int().positive(), status: prospectStatusSchema.optional(), notes: z.string().max(10000).nullable().optional() })).mutation(async ({ ctx, input }) => {
      const { prospectId, ...changes } = input;
      const updated = await updateRunProspect(ctx.user.id, prospectId, changes);
      if (!updated) throw new TRPCError({ code: "NOT_FOUND", message: "No se encontró el prospecto." });
      return updated;
    }),
    exportRows: protectedProcedure.input(z.object({ prospectIds: z.array(z.number().int().positive()).min(1).max(500) })).query(async ({ ctx, input }) => {
      const all = await listProspects(ctx.user.id, { limit: 5000 });
      const selected = all.filter(item => input.prospectIds.includes(item.prospect.id));
      return selected.map(({ prospect, business }) => ({
        lead_id: `lead_${business.id}`, business_name: business.name, category: business.category, location: [business.city, business.region, business.country].filter(Boolean).join(", "), address: business.address, phone: business.phone, website: business.website,
        website_status: business.websiteStatus, website_quality: business.websiteQuality, google_maps_url: business.googleMapsUrl, google_rating: business.rating, google_review_count: business.reviewCount, social_profiles: business.socialProfiles,
        whatsapp: business.whatsappUrl, booking: business.bookingUrl, opportunity_score: prospect.opportunityScore, business_attractiveness_score: prospect.businessAttractivenessScore, digital_opportunity_score: prospect.digitalOpportunityScore,
        website_opportunity_score: prospect.websiteOpportunityScore, commercial_potential_score: prospect.commercialPotentialScore, lead_potential_score: prospect.leadPotentialScore, urgency_score: prospect.urgencyScore,
        priority: prospect.priority, opportunity_types: prospect.opportunityTypes, opportunity_reasons: prospect.scoreReasons, ai_summary: prospect.analysisSummary, source: business.source, date_analyzed: prospect.lastCheckedAt.toISOString(),
      }));
    }),
    exportCsv: protectedProcedure.input(z.object({ prospectIds: z.array(z.number().int().positive()).min(1).max(500) })).mutation(async ({ ctx, input }) => {
      const all = await listProspects(ctx.user.id, { limit: 5000 });
      const rows = all.filter(item => input.prospectIds.includes(item.prospect.id)).map(({ prospect, business }) => ({ lead_id: `lead_${business.id}`, business_name: business.name, category: business.category, location: [business.city, business.region, business.country].filter(Boolean).join(", "), address: business.address, phone: business.phone, website: business.website, website_status: business.websiteStatus, website_quality: business.websiteQuality, google_maps_url: business.googleMapsUrl, google_rating: business.rating, google_review_count: business.reviewCount, social_profiles: business.socialProfiles, whatsapp: business.whatsappUrl, booking: business.bookingUrl, opportunity_score: prospect.opportunityScore, business_attractiveness_score: prospect.businessAttractivenessScore, digital_opportunity_score: prospect.digitalOpportunityScore, website_opportunity_score: prospect.websiteOpportunityScore, commercial_potential_score: prospect.commercialPotentialScore, lead_potential_score: prospect.leadPotentialScore, urgency_score: prospect.urgencyScore, priority: prospect.priority, opportunity_types: prospect.opportunityTypes, opportunity_reasons: prospect.scoreReasons, ai_summary: prospect.analysisSummary, source: business.source, date_analyzed: prospect.lastCheckedAt.toISOString() }));
      const headers = Object.keys(rows[0] ?? { lead_id: "" });
      return { filename: `nexo-prospectos-${new Date().toISOString().slice(0, 10)}.csv`, csv: [headers.join(","), ...rows.map(row => headers.map(header => csvSafe(row[header as keyof typeof row])).join(","))].join("\n") };
    }),
  }),
  profile: router({
    update: protectedProcedure.input(z.object({ name: z.string().trim().min(2).max(120).nullable().optional(), avatarUrl: z.string().url().max(1024).nullable().optional(), themePreference: z.enum(["system", "light", "dark"]).optional(), timezone: z.string().trim().min(1).max(64).optional() })).mutation(({ ctx, input }) => updateUserProfile(ctx.user.id, input)),
  }),
  admin: router({
    users: adminProcedure.query(() => listUsers()),
    updateRole: adminProcedure.input(z.object({ userId: z.number().int().positive(), role: z.enum(["admin", "user"]) })).mutation(({ input }) => updateUserRole(input.userId, input.role)),
  }),
});

export type AppRouter = typeof appRouter;

import { TRPCError } from "@trpc/server";
import { nanoid } from "nanoid";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { ENV } from "./_core/env";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import {
  createProspectActivity,
  createQualificationTemplate,
  createRawSearchResult,
  createRunEvent,
  createRunProspect,
  createProspectingRun,
  createSearchProfile,
  createUsageRecord,
  createWebsiteAnalysis,
  createWebScopeTemplate,
  deleteQualificationTemplate,
  deleteWebScopeTemplate,
  getOrCreateBudgetSettings,
  getOrCreateDefaultScoringProfile,
  getOrCreateGuideProgress,
  getOrCreateHandoffIntegration,
  getOrCreateHandoffPolicy,
  getOrCreateQualificationTemplates,
  getOrCreateWebScopeTemplates,
  getProspect,
  getProspectHandoff,
  getProspectReminders,
  getProspectingRun,
  getScannerDashboard,
  getUsageSummary,
  getWebScopeTemplate,
  listProspectExports,
  listProspectActivities,
  listProspectHandoffs,
  listProspectingRuns,
  listProspects,
  listRunEvents,
  listScoringProfiles,
  listSearchProfiles,
  listUsers,
  listWebsiteAnalyses,
  recordProspectExport,
  updateAnalyzedProspect,
  updateBudgetSettings,
  updateHandoffPolicy,
  updateBusinessWebsiteAnalysis,
  updateGuideProgress,
  updateHandoffIntegration,
  updateQualificationTemplate,
  updateRunProspect,
  updateScoringProfile,
  updateUserProfile,
  updateUserRole,
  updateWebScopeTemplate,
  updateProspectingRun,
  updateProspectHandoff,
  upsertProspectHandoff,
  upsertBusinessFromProvider,
} from "./db";
import { appendRowsToGoogleSheet, isGoogleSheetsConfigured } from "./googleSheets";
import { buildProviderQuery, findGoogleBusinesses, type SearchPlan } from "./googlePlacesProvider";
import { actualUsageStaysWithinPlan, buildCsvDocument, calculateProspectingPlan, getConfiguredCostPerOperationCents } from "./scannerPolicies";
import { DEFAULT_SCORING_THRESHOLDS, DEFAULT_SCORING_WEIGHTS, scoreBusiness } from "./scoring";
import { calibrateScoringWeights } from "./scoringCalibration";
import { buildProspectFollowup } from "./prospectFollowup";
import { analyzePublicWebsite, isPageSpeedConfigured } from "./websiteAnalyzer";
import { createValidationDemo } from "./demoValidation";
import { buildAuditDossier, evaluateHandoffEligibility } from "./handoff";
import { buildAuditDossierPdf } from "./auditPdf";
import { deliverSignedWebhook, validateWebhookUrl } from "./handoffWebhook";

const websiteStatusSchema = z.enum(["no_website", "website_found", "website_unreachable", "website_unknown"]);
const prioritySchema = z.enum(["p0", "p1", "p2", "p3", "ignore"]);
const prospectStatusSchema = z.enum(["new", "qualified", "rejected", "exported", "analysis_pending", "analyzed", "demo_pending", "contact_pending", "contacted", "converted", "lost"]);
const handoffStatusSchema = z.enum(["ready_for_review", "approved", "package_exported", "delivered", "returned"]);
const dueStateSchema = z.enum(["overdue", "today", "upcoming", "none"]);
const runStatusSchema = z.enum(["queued", "running", "paused", "completed", "partial", "failed", "cancelled"]);
export const authorizedSourceSchema = z.enum(["csv_import", "manual_entry", "google_maps"]);
const scopeTemplateInput = z.object({ name: z.string().trim().min(2).max(140), sector: z.string().trim().min(2).max(100), overview: z.string().trim().min(10).max(5000), deliverables: z.array(z.string().trim().min(2).max(300)).min(1).max(20), successMetrics: z.array(z.string().trim().min(2).max(300)).min(1).max(20), isDefault: z.number().int().min(0).max(1).optional() });
const handoffIntegrationInput = z.object({ displayName: z.string().trim().min(2).max(160), webhookUrl: z.string().trim().url().max(2048).nullable(), isEnabled: z.boolean() });
const calibrationRowSchema = z.object({
  outcome: z.enum(["won", "lost"]),
  noWebsite: z.boolean().nullable(), weakWebsite: z.boolean().nullable(), reviewCount: z.number().int().min(0).max(1000000).nullable(), rating: z.number().min(0).max(5).nullable(),
  hasPhone: z.boolean().nullable(), hasBooking: z.boolean().nullable(), hasWhatsapp: z.boolean().nullable(), commercialPotential: z.enum(["low", "medium", "high", "very_high"]).nullable(),
});

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

const importRecordInput = z.object({
  externalId: z.string().trim().max(255).optional(),
  name: z.string().trim().min(2).max(255),
  category: z.string().trim().max(120).nullable().optional(),
  address: z.string().trim().max(500).nullable().optional(),
  city: z.string().trim().max(120).nullable().optional(),
  region: z.string().trim().max(120).nullable().optional(),
  country: z.string().trim().max(80).nullable().optional(),
  phone: z.string().trim().max(64).nullable().optional(),
  website: z.string().trim().url().max(1024).nullable().optional(),
  rating: z.number().min(0).max(5).nullable().optional(),
  reviewCount: z.number().int().min(0).max(1000000).nullable().optional(),
  isDemo: z.boolean().optional(),
});

const importInput = searchInput.extend({
  source: z.enum(["csv_import", "manual_entry"]),
  records: z.array(importRecordInput).min(1).max(500),
});

type SearchInput = z.infer<typeof searchInput>;

function asNumberRecord(value: unknown, fallback: Record<string, number>) {
  if (!value || typeof value !== "object") return fallback;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).filter(([, item]) => typeof item === "number")) as Record<string, number>;
}

function domainFromUrl(value?: string) {
  if (!value) return null;
  try { return new URL(value).hostname.replace(/^www\./, "").toLowerCase(); } catch { return null; }
}

function dataQualityOf(business: { address?: string | null; phone?: string | null; website?: string | null; rating?: number | null; reviewCount?: number | null }) {
  return [business.address, business.phone, business.website, business.rating !== undefined, business.reviewCount !== undefined].filter(Boolean).length * 20;
}

function identityFragment(value?: string | null) {
  return (value ?? "").toLocaleLowerCase("es").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function exportRowFromProspect({ prospect, business }: Awaited<ReturnType<typeof listProspects>>[number]) {
  return {
    lead_id: `lead_${business.id}`, business_name: business.name, category: business.category, location: [business.city, business.region, business.country].filter(Boolean).join(", "), address: business.address, phone: business.phone, website: business.website,
    website_status: business.websiteStatus, website_quality: business.websiteQuality, google_maps_url: business.googleMapsUrl, google_rating: business.rating, google_review_count: business.reviewCount, social_profiles: business.socialProfiles,
    whatsapp: business.whatsappUrl, booking: business.bookingUrl, opportunity_score: prospect.opportunityScore, business_attractiveness_score: prospect.businessAttractivenessScore, digital_opportunity_score: prospect.digitalOpportunityScore,
    website_opportunity_score: prospect.websiteOpportunityScore, commercial_potential_score: prospect.commercialPotentialScore, lead_potential_score: prospect.leadPotentialScore, urgency_score: prospect.urgencyScore,
    priority: prospect.priority, commercial_status: prospect.status, next_action: prospect.nextActionLabel, next_action_at: prospect.nextActionAt?.toISOString() ?? null, opportunity_types: prospect.opportunityTypes, opportunity_reasons: prospect.scoreReasons, ai_summary: prospect.analysisSummary, source: business.source, date_analyzed: prospect.lastCheckedAt.toISOString(),
  };
}

function asHandoffPolicy(policy: { minimumOpportunityScore: number; requireNextAction: number; requireDigitalEvidence: number }) {
  return { minimumOpportunityScore: policy.minimumOpportunityScore, requireNextAction: Boolean(policy.requireNextAction), requireDigitalEvidence: Boolean(policy.requireDigitalEvidence) };
}

function handoffEligibilityFromProspect(item: Awaited<ReturnType<typeof listProspects>>[number], policy: ReturnType<typeof asHandoffPolicy>) {
  return evaluateHandoffEligibility({ status: item.prospect.status, opportunityScore: item.prospect.opportunityScore, nextActionLabel: item.prospect.nextActionLabel, nextActionAt: item.prospect.nextActionAt, websiteStatus: item.business.websiteStatus, websiteQuality: item.business.websiteQuality, isDemo: Boolean(item.business.isDemo) }, policy);
}

export function assertNoDemoProspects(items: Array<{ business: { isDemo: number } }>) {
  if (items.some(item => Boolean(item.business.isDemo))) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Los registros de demostración no se pueden exportar, transferir a auditoría ni usar en operaciones comerciales." });
  }
}

export function renderTemplate(value: string | null, replacements: Record<string, string>) {
  if (!value) return null;
  return value.replace(/{{([a-z_]+)}}/g, (_, token: string) => replacements[token] ?? `{{${token}}}`);
}

export function assertGoogleSheetsEligibility(statuses: string[]) {
  if (statuses.some(status => status !== "qualified")) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Solo se pueden entregar a Google Sheets prospectos cualificados. Actualiza el estado a «Aprobado» antes de exportar." });
  }
}

async function executeRun(ownerId: number, input: SearchInput) {
  if (!ENV.paidConnectorsEnabled) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Google Places permanece inactivo como placeholder en el modo sin coste. Para usarlo, configura sus credenciales y habilita NEXO_ENABLE_PAID_CONNECTORS=true de forma explícita.",
    });
  }
  if (!ENV.forgeApiKey || !ENV.forgeApiUrl) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Google Places no está configurado. Añade las credenciales autorizadas antes de activar el conector.",
    });
  }
  const budget = await getOrCreateBudgetSettings(ownerId);
  const usage = await getUsageSummary(ownerId);
  const plan = calculateProspectingPlan(input, budget, usage, getConfiguredCostPerOperationCents());
  if (!plan.allowed) throw new TRPCError({ code: "PRECONDITION_FAILED", message: plan.reasons.join(" ") });
  const scoring = await getOrCreateDefaultScoringProfile(ownerId);
  const weights = asNumberRecord(scoring.weights, DEFAULT_SCORING_WEIGHTS);
  const thresholds = asNumberRecord(scoring.thresholds, DEFAULT_SCORING_THRESHOLDS);
  const query = buildProviderQuery({ country: input.country, city: input.city, district: input.district, referenceAddress: input.referenceAddress, category: input.primaryCategory, keywords: input.keywords, radiusMeters: input.radiusMeters, maxResults: plan.requested });
  const run = await createProspectingRun({
    ownerId, publicId: `RUN-${nanoid(8).toUpperCase()}`, provider: "google_maps", query, country: input.country, city: input.city, district: input.district ?? null, referenceAddress: input.referenceAddress ?? null,
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
    await createUsageRecord({ ownerId, runId: run.id, provider: "google_maps", operation: "places_search_and_details", requestCount: response.operations, estimatedCostCents: response.operations * getConfiguredCostPerOperationCents() });
    await createRunEvent({ runId: run.id, stage: "search", message: `La fuente autorizada devolvió ${response.businesses.length} resultados.` });
    await createRunEvent({ runId: run.id, stage: "details", message: `Se recibieron ${response.operations} operaciones de búsqueda y detalle desde el proveedor autorizado.` });

    const actualCostCents = response.operations * getConfiguredCostPerOperationCents();
    if (!actualUsageStaysWithinPlan(response.operations, actualCostCents, plan, budget)) {
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

async function importBusinesses(ownerId: number, input: z.infer<typeof importInput>) {
  const scoring = await getOrCreateDefaultScoringProfile(ownerId);
  const weights = asNumberRecord(scoring.weights, DEFAULT_SCORING_WEIGHTS);
  const thresholds = asNumberRecord(scoring.thresholds, DEFAULT_SCORING_THRESHOLDS);
  const sourceLabel = input.source === "csv_import" ? "Importación CSV" : "Entrada manual";
  const run = await createProspectingRun({
    ownerId,
    publicId: `IMP-${nanoid(8).toUpperCase()}`,
    provider: input.source,
    query: `${sourceLabel}: ${input.primaryCategory} en ${input.city}`,
    country: input.country,
    city: input.city,
    district: input.district ?? null,
    referenceAddress: input.referenceAddress ?? null,
    radiusMeters: input.radiusMeters,
    primaryCategory: input.primaryCategory,
    keywords: input.keywords,
    excludedKeywords: input.excludedKeywords,
    websiteMode: input.websiteMode,
    maxResults: input.records.length,
    minRating: input.minRating ?? null,
    minReviewCount: input.minReviewCount,
    minOpportunityScore: input.minOpportunityScore,
    scoringSnapshot: { ...weights, ...thresholds },
    estimatedOperations: 0,
    estimatedCostCents: 0,
  });
  await updateProspectingRun(run.id, ownerId, { status: "running", startedAt: new Date() });
  await createRunEvent({ runId: run.id, stage: "plan", message: `${sourceLabel} confirmada: ${input.records.length} registros locales sin consulta externa.` });
  await createRunEvent({ runId: run.id, stage: "budget", message: "No se reservó presupuesto de proveedores; esta importación no realiza solicitudes externas." });

  let processed = 0;
  let qualified = 0;
  const unique = new Map<string, z.infer<typeof importRecordInput>>();
  for (const record of input.records) {
    const deduplicationKey = [identityFragment(record.name), identityFragment(record.address), identityFragment(record.website ?? record.phone)].filter(Boolean).join(":");
    if (deduplicationKey && !unique.has(deduplicationKey)) unique.set(deduplicationKey, record);
  }
  await createRunEvent({ runId: run.id, stage: "deduplicate", message: `${input.records.length - unique.size} registros repetidos se descartaron usando nombre y datos de contacto disponibles.` });

  try {
    for (const [deduplicationKey, record] of Array.from(unique.entries())) {
      const websiteStatus = record.website ? "website_found" : "no_website";
      if (input.websiteMode === "no_website" && websiteStatus !== "no_website") continue;
      if (input.websiteMode === "with_website" && websiteStatus !== "website_found") continue;
      if (input.minRating !== null && input.minRating !== undefined && (record.rating ?? 0) < input.minRating) continue;
      if ((record.reviewCount ?? 0) < input.minReviewCount) continue;
      const externalId = record.externalId || `${input.source}:${deduplicationKey || nanoid(10)}`;
      await createRawSearchResult({ runId: run.id, provider: input.source, providerRecordId: externalId, query: run.query, payload: record });
      const saved = await upsertBusinessFromProvider({
        ownerId, source: input.source, externalId, deduplicationKey: `${input.source}:${deduplicationKey || externalId}`,
        name: record.name, category: record.category || input.primaryCategory, categories: record.category ? [record.category] : [input.primaryCategory],
        address: record.address ?? null, city: record.city || input.city, region: record.region ?? null, country: record.country || input.country,
        phone: record.phone ?? null, website: record.website ?? null, domain: domainFromUrl(record.website ?? undefined), rating: record.rating ?? null, reviewCount: record.reviewCount ?? null,
        isDemo: record.isDemo ? 1 : 0, websiteStatus, dataQualityScore: dataQualityOf(record),
      });
      const evaluated = scoreBusiness({ rating: record.rating, reviewCount: record.reviewCount, websiteStatus, websiteQuality: "not_analyzed", hasPhone: Boolean(record.phone), hasBooking: false, hasWhatsapp: false, commercialPotential: "medium" }, weights, thresholds);
      const status = evaluated.opportunityScore >= input.minOpportunityScore ? "qualified" : "rejected";
      await createRunProspect({ runId: run.id, businessId: saved.business.id, duplicateConfidence: saved.isKnown ? "exact" : "high", status, ...evaluated, scoreReasons: evaluated.reasons, analysisSummary: evaluated.summary });
      processed += 1;
      if (status === "qualified") qualified += 1;
    }
    await updateProspectingRun(run.id, ownerId, { status: "completed", foundCount: input.records.length, uniqueCount: unique.size, qualifiedCount: qualified, rejectedCount: processed - qualified, finishedAt: new Date() });
    await createRunEvent({ runId: run.id, stage: "score", message: `${processed} registros importados se puntuaron; ${qualified} superaron el umbral.` });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo completar la importación.";
    await updateProspectingRun(run.id, ownerId, { status: processed ? "partial" : "failed", foundCount: input.records.length, uniqueCount: unique.size, qualifiedCount: qualified, rejectedCount: Math.max(0, processed - qualified), errorCount: 1, finishedAt: new Date() });
    await createRunEvent({ runId: run.id, stage: "normalize", level: "error", errorCode: "IMPORT_PROCESSING_ERROR", recoverable: 1, message: `La importación se detuvo: ${message}` });
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
      googleMaps: {
        configured: Boolean(ENV.paidConnectorsEnabled && ENV.forgeApiKey && ENV.forgeApiUrl),
        state: ENV.paidConnectorsEnabled && ENV.forgeApiKey && ENV.forgeApiUrl ? "activo" as const : "placeholder_inactivo" as const,
        mode: "official_proxy" as const,
        activation: "Configura el acceso oficial y establece NEXO_ENABLE_PAID_CONNECTORS=true.",
      },
      googleSheets: {
        configured: isGoogleSheetsConfigured(),
        state: isGoogleSheetsConfigured() ? "activo" as const : "placeholder_inactivo" as const,
        mode: "service_account" as const,
        activation: "Añade la cuenta de servicio, el ID de la hoja y establece NEXO_ENABLE_PAID_CONNECTORS=true.",
      },
      websiteAnalyzer: {
        configured: isPageSpeedConfigured(),
        state: isPageSpeedConfigured() ? "activo" as const : "placeholder_inactivo" as const,
        mode: "pagespeed_insights" as const,
        activation: "Añade la API key de PageSpeed y establece NEXO_ENABLE_PAID_CONNECTORS=true; la comprobación pública básica seguirá disponible.",
      },
    })),
  }),
  settings: router({
    budget: protectedProcedure.query(({ ctx }) => getOrCreateBudgetSettings(ctx.user.id)),
    updateBudget: protectedProcedure.input(z.object({ dailyRequestBudget: z.number().int().min(1).max(100000).optional(), monthlyRequestBudget: z.number().int().min(1).max(1000000).optional(), maxCostPerRunCents: z.number().int().min(0).max(10000000).optional(), maxBusinessesPerRun: z.number().int().min(1).max(50).optional(), maxAiCallsPerRun: z.number().int().min(0).max(1000).optional() })).mutation(({ ctx, input }) => updateBudgetSettings(ctx.user.id, input)),
    scoringProfiles: protectedProcedure.query(async ({ ctx }) => {
      await getOrCreateDefaultScoringProfile(ctx.user.id);
      return listScoringProfiles(ctx.user.id);
    }),
    updateScoring: protectedProcedure.input(z.object({ profileId: z.number().int().positive(), name: z.string().trim().min(2).max(120).optional(), weights: z.record(z.string(), z.number().min(-100).max(100)).optional(), thresholds: z.record(z.string(), z.number().min(0).max(100)).optional() })).mutation(({ ctx, input }) => { const { profileId, ...data } = input; return updateScoringProfile(ctx.user.id, profileId, data); }),
    calibrateScoring: protectedProcedure.input(z.object({ rows: z.array(calibrationRowSchema).min(8).max(500) })).mutation(async ({ ctx, input }) => {
      const profile = await getOrCreateDefaultScoringProfile(ctx.user.id);
      return calibrateScoringWeights(input.rows, asNumberRecord(profile.weights, DEFAULT_SCORING_WEIGHTS), asNumberRecord(profile.thresholds, DEFAULT_SCORING_THRESHOLDS));
    }),
  }),
  searchProfiles: router({
    list: protectedProcedure.query(({ ctx }) => listSearchProfiles(ctx.user.id)),
    create: protectedProcedure.input(searchInput.extend({ name: z.string().trim().min(2).max(120), provider: authorizedSourceSchema })).mutation(({ ctx, input }) => {
      const { name, ...profile } = input;
      return createSearchProfile(ctx.user.id, { name, ...profile });
    }),
  }),
  demo: router({
    createValidation: protectedProcedure.mutation(async ({ ctx }) => {
      try {
        return await createValidationDemo(ctx.user.id, { listProspects, importBusinesses, updateRunProspect, createProspectActivity });
      } catch (error) {
        if (error instanceof Error && error.message === "No se pudo crear el prospecto de demostración.") {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
        }
        throw error;
      }
    }),
  }),
  runs: router({
    plan: protectedProcedure.input(searchInput).query(async ({ ctx, input }) => {
      const [budget, usage, scoring] = await Promise.all([getOrCreateBudgetSettings(ctx.user.id), getUsageSummary(ctx.user.id), getOrCreateDefaultScoringProfile(ctx.user.id)]);
      return { query: buildProviderQuery({ country: input.country, city: input.city, district: input.district, referenceAddress: input.referenceAddress, category: input.primaryCategory, keywords: input.keywords, radiusMeters: input.radiusMeters, maxResults: input.maxResults }), plan: calculateProspectingPlan(input, budget, usage, getConfiguredCostPerOperationCents()), budget, usage, scoringProfile: { id: scoring.id, name: scoring.name } };
    }),
    execute: protectedProcedure.input(searchInput.extend({ confirmed: z.literal(true) })).mutation(({ ctx, input }) => executeRun(ctx.user.id, input)),
    import: protectedProcedure.input(importInput.extend({ confirmed: z.literal(true) })).mutation(({ ctx, input }) => importBusinesses(ctx.user.id, input)),
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
    list: protectedProcedure.input(z.object({ runId: z.number().int().positive().optional(), priority: prioritySchema.optional(), status: prospectStatusSchema.optional(), dueState: dueStateSchema.optional(), readiness: z.enum(["ready", "not_ready", "queued"]).optional(), websiteStatus: websiteStatusSchema.optional(), minimumScore: z.number().int().min(0).max(100).optional(), query: z.string().trim().max(160).optional(), limit: z.number().int().min(1).max(500).optional() }).optional()).query(async ({ ctx, input }) => {
      const [rows, policy] = await Promise.all([listProspects(ctx.user.id, input), getOrCreateHandoffPolicy(ctx.user.id)]);
      const enriched = rows.map(item => ({ ...item, handoffEligibility: handoffEligibilityFromProspect(item, asHandoffPolicy(policy)) }));
      if (input?.readiness === "ready") return enriched.filter(item => item.handoffEligibility.eligible);
      if (input?.readiness === "not_ready") return enriched.filter(item => !item.handoffEligibility.eligible);
      if (input?.readiness === "queued") {
        const queued = new Set((await listProspectHandoffs(ctx.user.id)).map(item => item.prospect.id));
        return enriched.filter(item => queued.has(item.prospect.id));
      }
      return enriched;
    }),
    get: protectedProcedure.input(z.object({ prospectId: z.number().int().positive() })).query(async ({ ctx, input }) => {
      const value = await getProspect(ctx.user.id, input.prospectId);
      if (!value) throw new TRPCError({ code: "NOT_FOUND", message: "No se encontró el prospecto." });
      return value;
    }),
    update: protectedProcedure.input(z.object({ prospectId: z.number().int().positive(), status: prospectStatusSchema.optional(), notes: z.string().max(10000).nullable().optional(), commercialNote: z.string().trim().max(2000).optional(), nextActionLabel: z.string().trim().max(240).nullable().optional(), nextActionAt: z.date().nullable().optional() })).mutation(async ({ ctx, input }) => {
      const current = await getProspect(ctx.user.id, input.prospectId);
      if (!current) throw new TRPCError({ code: "NOT_FOUND", message: "No se encontró el prospecto." });
      const { prospectId, commercialNote, ...changes } = input;
      const followup = buildProspectFollowup(current.prospect, { ...changes, commercialNote });
      const updated = await updateRunProspect(ctx.user.id, prospectId, { ...changes, ...(followup.markContactedAt ? { lastContactedAt: new Date() } : {}) });
      if (!updated) throw new TRPCError({ code: "NOT_FOUND", message: "No se encontró el prospecto." });
      if (followup.hasCommercialChange) await createProspectActivity({ ownerId: ctx.user.id, prospectId, ...followup.activity });
      return updated;
    }),
    activities: protectedProcedure.input(z.object({ prospectId: z.number().int().positive() })).query(({ ctx, input }) => listProspectActivities(ctx.user.id, input.prospectId)),
    reminders: protectedProcedure.query(({ ctx }) => getProspectReminders(ctx.user.id)),
    exportRows: protectedProcedure.input(z.object({ prospectIds: z.array(z.number().int().positive()).min(1).max(500) })).query(async ({ ctx, input }) => {
      const all = await listProspects(ctx.user.id, { limit: 5000 });
      const selected = all.filter(item => input.prospectIds.includes(item.prospect.id));
      assertNoDemoProspects(selected);
      return selected.map(exportRowFromProspect);
    }),
    exportCsv: protectedProcedure.input(z.object({ prospectIds: z.array(z.number().int().positive()).min(1).max(500) })).mutation(async ({ ctx, input }) => {
      const all = await listProspects(ctx.user.id, { limit: 5000 });
      const selected = all.filter(item => input.prospectIds.includes(item.prospect.id));
      assertNoDemoProspects(selected);
      const rows = selected.map(exportRowFromProspect);
      return { filename: `nexo-prospectos-${new Date().toISOString().slice(0, 10)}.csv`, csv: buildCsvDocument(rows) };
    }),
    exportGoogleSheets: protectedProcedure.input(z.object({ prospectIds: z.array(z.number().int().positive()).min(1).max(500) })).mutation(async ({ ctx, input }) => {
      if (!isGoogleSheetsConfigured()) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Google Sheets está inactivo como placeholder. Activa sus credenciales y NEXO_ENABLE_PAID_CONNECTORS=true para habilitar esta entrega." });
      }
      const all = await listProspects(ctx.user.id, { limit: 5000 });
      const selected = all.filter(item => input.prospectIds.includes(item.prospect.id));
      if (selected.length !== input.prospectIds.length) throw new TRPCError({ code: "NOT_FOUND", message: "Uno o más prospectos no están disponibles para exportar." });
      assertNoDemoProspects(selected);
      assertGoogleSheetsEligibility(selected.map(item => item.prospect.status));
      try {
        const output = await appendRowsToGoogleSheet(selected.map(exportRowFromProspect));
        await Promise.all(selected.map(item => Promise.all([
          recordProspectExport({ ownerId: ctx.user.id, prospectId: item.prospect.id, destination: "google_sheets", destinationLabel: output.destinationLabel, externalReference: output.externalReference, status: "succeeded" }),
          updateRunProspect(ctx.user.id, item.prospect.id, { status: "exported" }),
        ])));
        return output;
      } catch (error) {
        const message = error instanceof Error ? error.message : "No se pudo entregar la exportación a Google Sheets.";
        await Promise.all(selected.map(item => recordProspectExport({ ownerId: ctx.user.id, prospectId: item.prospect.id, destination: "google_sheets", destinationLabel: "Google Sheets", status: "failed", errorMessage: message.slice(0, 1000) })));
        throw new TRPCError({ code: "PRECONDITION_FAILED", message });
      }
    }),
    exports: protectedProcedure.input(z.object({ prospectId: z.number().int().positive() })).query(({ ctx, input }) => listProspectExports(ctx.user.id, input.prospectId)),
    analyzeWebsite: protectedProcedure.input(z.object({ prospectId: z.number().int().positive(), strategy: z.enum(["mobile", "desktop"]).default("mobile") })).mutation(async ({ ctx, input }) => {
      const current = await getProspect(ctx.user.id, input.prospectId);
      if (!current) throw new TRPCError({ code: "NOT_FOUND", message: "No se encontró el prospecto." });
      if (!current.business.website) {
        await createWebsiteAnalysis({ ownerId: ctx.user.id, prospectId: input.prospectId, url: "", strategy: input.strategy, status: "skipped", summary: "No se analizó porque la fuente autorizada no proporcionó sitio web." });
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Este negocio no tiene un sitio web público para analizar." });
      }
      try {
        const result = await analyzePublicWebsite(current.business.website, input.strategy);
        await createWebsiteAnalysis({ ownerId: ctx.user.id, prospectId: input.prospectId, url: current.business.website, strategy: result.strategy, status: "completed", performanceScore: result.performanceScore, accessibilityScore: result.accessibilityScore, bestPracticesScore: result.bestPracticesScore, seoScore: result.seoScore, signals: result.signals, summary: result.summary });
        await updateBusinessWebsiteAnalysis(ctx.user.id, current.business.id, { websiteQuality: result.quality, websiteSignals: result.signals });
        const scoring = await getOrCreateDefaultScoringProfile(ctx.user.id);
        const evaluated = scoreBusiness({ rating: Number(current.business.rating ?? 0), reviewCount: current.business.reviewCount ?? 0, websiteStatus: current.business.websiteStatus, websiteQuality: result.quality, hasPhone: Boolean(current.business.phone), hasBooking: Boolean(current.business.bookingUrl), hasWhatsapp: Boolean(current.business.whatsappUrl), commercialPotential: "medium" }, asNumberRecord(scoring.weights, DEFAULT_SCORING_WEIGHTS), asNumberRecord(scoring.thresholds, DEFAULT_SCORING_THRESHOLDS));
        const updated = await updateAnalyzedProspect(ctx.user.id, input.prospectId, { status: "analyzed", ...evaluated, scoreReasons: evaluated.reasons, analysisSummary: result.summary, analysisConfidence: 0.9 });
        return { analysis: result, prospect: updated };
      } catch (error) {
        const message = error instanceof Error ? error.message : "No se pudo completar el análisis autorizado.";
        await createWebsiteAnalysis({ ownerId: ctx.user.id, prospectId: input.prospectId, url: current.business.website, strategy: input.strategy, status: "failed", errorMessage: message.slice(0, 1000) });
        throw new TRPCError({ code: "PRECONDITION_FAILED", message });
      }
    }),
    analyses: protectedProcedure.input(z.object({ prospectId: z.number().int().positive() })).query(({ ctx, input }) => listWebsiteAnalyses(ctx.user.id, input.prospectId)),
  }),
  handoffs: router({
    policy: protectedProcedure.query(({ ctx }) => getOrCreateHandoffPolicy(ctx.user.id)),
    updatePolicy: protectedProcedure.input(z.object({ minimumOpportunityScore: z.number().int().min(0).max(100).optional(), requireNextAction: z.boolean().optional(), requireDigitalEvidence: z.boolean().optional(), destinationLabel: z.string().trim().min(2).max(160).optional() })).mutation(({ ctx, input }) => updateHandoffPolicy(ctx.user.id, { ...(input.minimumOpportunityScore === undefined ? {} : { minimumOpportunityScore: input.minimumOpportunityScore }), ...(input.destinationLabel === undefined ? {} : { destinationLabel: input.destinationLabel }), ...(input.requireNextAction === undefined ? {} : { requireNextAction: input.requireNextAction ? 1 : 0 }), ...(input.requireDigitalEvidence === undefined ? {} : { requireDigitalEvidence: input.requireDigitalEvidence ? 1 : 0 }) })),
    integration: protectedProcedure.query(async ({ ctx }) => {
      const integration = await getOrCreateHandoffIntegration(ctx.user.id);
      return { ...integration, hasSigningSecret: Boolean(ENV.handoffWebhookSecret) };
    }),
    updateIntegration: protectedProcedure.input(handoffIntegrationInput).mutation(async ({ ctx, input }) => {
      const webhookUrl = input.webhookUrl ? await validateWebhookUrl(input.webhookUrl) : null;
      if (input.isEnabled && !webhookUrl) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Introduce una URL HTTPS pública antes de activar el webhook." });
      if (input.isEnabled && !ENV.handoffWebhookSecret) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Falta el secreto NEXO_HANDOFF_WEBHOOK_SECRET en la configuración segura del proyecto. Guarda el destino desactivado hasta añadirlo." });
      return updateHandoffIntegration(ctx.user.id, { displayName: input.displayName, webhookUrl, isEnabled: input.isEnabled ? 1 : 0 });
    }),
    list: protectedProcedure.input(z.object({ status: handoffStatusSchema.optional() }).optional()).query(({ ctx, input }) => listProspectHandoffs(ctx.user.id, input?.status)),
    eligibility: protectedProcedure.input(z.object({ prospectId: z.number().int().positive() })).query(async ({ ctx, input }) => {
      const [item, policy, handoff] = await Promise.all([getProspect(ctx.user.id, input.prospectId), getOrCreateHandoffPolicy(ctx.user.id), getProspectHandoff(ctx.user.id, input.prospectId)]);
      if (!item) throw new TRPCError({ code: "NOT_FOUND", message: "No se encontró el prospecto." });
      return { eligibility: handoffEligibilityFromProspect(item, asHandoffPolicy(policy)), handoff, policy };
    }),
    queue: protectedProcedure.input(z.object({ prospectId: z.number().int().positive(), note: z.string().trim().max(2000).nullable().optional() })).mutation(async ({ ctx, input }) => {
      const [item, policy] = await Promise.all([getProspect(ctx.user.id, input.prospectId), getOrCreateHandoffPolicy(ctx.user.id)]);
      if (!item) throw new TRPCError({ code: "NOT_FOUND", message: "No se encontró el prospecto." });
      assertNoDemoProspects([item]);
      const eligibility = handoffEligibilityFromProspect(item, asHandoffPolicy(policy));
      if (!eligibility.eligible) throw new TRPCError({ code: "PRECONDITION_FAILED", message: `Aún no se puede pasar a auditoría: ${eligibility.reasons.join(" ")}` });
      const handoff = await upsertProspectHandoff({ ownerId: ctx.user.id, prospectId: input.prospectId, destinationLabel: policy.destinationLabel, eligibilitySnapshot: eligibility.criteria, note: input.note ?? null });
      await createProspectActivity({ ownerId: ctx.user.id, prospectId: input.prospectId, action: "handoff_queued", note: "Oportunidad incorporada a la cola de auditoría web.", nextStatus: item.prospect.status });
      return handoff;
    }),
    approve: protectedProcedure.input(z.object({ prospectId: z.number().int().positive(), note: z.string().trim().max(2000).nullable().optional() })).mutation(async ({ ctx, input }) => {
      const item = await getProspect(ctx.user.id, input.prospectId);
      if (!item) throw new TRPCError({ code: "NOT_FOUND", message: "No se encontró el prospecto." });
      assertNoDemoProspects([item]);
      const handoff = await updateProspectHandoff(ctx.user.id, input.prospectId, { status: "approved", approvedAt: new Date(), note: input.note ?? null });
      if (!handoff) throw new TRPCError({ code: "NOT_FOUND", message: "Primero incorpora esta oportunidad a la cola de auditoría." });
      await createProspectActivity({ ownerId: ctx.user.id, prospectId: input.prospectId, action: "handoff_approved", note: "La oportunidad fue aprobada para preparar el expediente de auditoría." });
      return handoff;
    }),
    dossier: protectedProcedure.input(z.object({ prospectId: z.number().int().positive(), scopeTemplateId: z.number().int().positive().nullable().optional(), markExported: z.boolean().default(false) })).mutation(async ({ ctx, input }) => {
      const [item, policy, analyses, handoff] = await Promise.all([getProspect(ctx.user.id, input.prospectId), getOrCreateHandoffPolicy(ctx.user.id), listWebsiteAnalyses(ctx.user.id, input.prospectId), getProspectHandoff(ctx.user.id, input.prospectId)]);
      if (!item) throw new TRPCError({ code: "NOT_FOUND", message: "No se encontró el prospecto." });
      assertNoDemoProspects([item]);
      if (!handoff || !["approved", "package_exported", "delivered"].includes(handoff.status)) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Aprueba primero la oportunidad en la cola de auditoría." });
      const eligibility = handoffEligibilityFromProspect(item, asHandoffPolicy(policy));
      const scopeTemplate = input.scopeTemplateId ? await getWebScopeTemplate(ctx.user.id, input.scopeTemplateId) : null;
      if (input.scopeTemplateId && !scopeTemplate) throw new TRPCError({ code: "NOT_FOUND", message: "No se encontró la plantilla sectorial seleccionada." });
      const dossier = buildAuditDossier({ business: item.business, prospect: item.prospect, eligibility, analyses, scopeTemplate });
      if (input.markExported && handoff.status !== "delivered") {
        await updateProspectHandoff(ctx.user.id, input.prospectId, { status: "package_exported", packageExportedAt: new Date(), eligibilitySnapshot: eligibility.criteria });
        await createProspectActivity({ ownerId: ctx.user.id, prospectId: input.prospectId, action: "audit_package_exported", note: "Expediente de auditoría exportado para revisión externa." });
      }
      return { filename: `nexo-expediente-${item.business.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || input.prospectId}.json`, dossier };
    }),
    dossierPdf: protectedProcedure.input(z.object({ prospectId: z.number().int().positive(), scopeTemplateId: z.number().int().positive().nullable().optional(), markExported: z.boolean().default(false) })).mutation(async ({ ctx, input }) => {
      const [item, policy, analyses, handoff] = await Promise.all([getProspect(ctx.user.id, input.prospectId), getOrCreateHandoffPolicy(ctx.user.id), listWebsiteAnalyses(ctx.user.id, input.prospectId), getProspectHandoff(ctx.user.id, input.prospectId)]);
      if (!item) throw new TRPCError({ code: "NOT_FOUND", message: "No se encontró el prospecto." });
      assertNoDemoProspects([item]);
      if (!handoff || !["approved", "package_exported", "delivered"].includes(handoff.status)) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Aprueba primero la oportunidad en la cola de auditoría." });
      const scopeTemplate = input.scopeTemplateId ? await getWebScopeTemplate(ctx.user.id, input.scopeTemplateId) : null;
      if (input.scopeTemplateId && !scopeTemplate) throw new TRPCError({ code: "NOT_FOUND", message: "No se encontró la plantilla sectorial seleccionada." });
      const eligibility = handoffEligibilityFromProspect(item, asHandoffPolicy(policy));
      const dossier = buildAuditDossier({ business: item.business, prospect: item.prospect, eligibility, analyses, scopeTemplate });
      const pdf = await buildAuditDossierPdf(dossier);
      if (input.markExported && handoff.status !== "delivered") {
        await updateProspectHandoff(ctx.user.id, input.prospectId, { status: "package_exported", packageExportedAt: new Date(), eligibilitySnapshot: eligibility.criteria });
        await createProspectActivity({ ownerId: ctx.user.id, prospectId: input.prospectId, action: "audit_package_exported", note: "Expediente de auditoría PDF exportado para revisión externa." });
      }
      const slug = item.business.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || input.prospectId;
      return { filename: `nexo-expediente-${slug}.pdf`, mimeType: "application/pdf", contentBase64: Buffer.from(pdf).toString("base64") };
    }),
    sendToSaas: protectedProcedure.input(z.object({ prospectId: z.number().int().positive(), scopeTemplateId: z.number().int().positive().nullable().optional() })).mutation(async ({ ctx, input }) => {
      const [item, policy, analyses, handoff, integration] = await Promise.all([getProspect(ctx.user.id, input.prospectId), getOrCreateHandoffPolicy(ctx.user.id), listWebsiteAnalyses(ctx.user.id, input.prospectId), getProspectHandoff(ctx.user.id, input.prospectId), getOrCreateHandoffIntegration(ctx.user.id)]);
      if (!item) throw new TRPCError({ code: "NOT_FOUND", message: "No se encontró el prospecto." });
      assertNoDemoProspects([item]);
      if (!handoff || !["approved", "package_exported"].includes(handoff.status)) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Aprueba primero la oportunidad y prepara su expediente antes de entregarla al SaaS." });
      if (!integration.isEnabled || !integration.webhookUrl || !ENV.handoffWebhookSecret) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "El webhook SaaS no está listo. Revisa la URL, la activación y el secreto de firma en el panel de integración." });
      const scopeTemplate = input.scopeTemplateId ? await getWebScopeTemplate(ctx.user.id, input.scopeTemplateId) : null;
      if (input.scopeTemplateId && !scopeTemplate) throw new TRPCError({ code: "NOT_FOUND", message: "No se encontró la plantilla sectorial seleccionada." });
      const eligibility = handoffEligibilityFromProspect(item, asHandoffPolicy(policy));
      const dossier = buildAuditDossier({ business: item.business, prospect: item.prospect, eligibility, analyses, scopeTemplate });
      const deliveryId = `handoff_${nanoid(12)}`;
      try {
        const result = await deliverSignedWebhook({ webhookUrl: integration.webhookUrl, secret: ENV.handoffWebhookSecret, event: "audit.dossier.ready", deliveryId, payload: { deliveryId, dossier } });
        const externalReference = result.reference ?? deliveryId;
        await Promise.all([
          updateProspectHandoff(ctx.user.id, input.prospectId, { status: "delivered", deliveredAt: new Date(), externalReference }),
          updateHandoffIntegration(ctx.user.id, { lastDeliveryAt: new Date(), lastDeliveryStatus: "succeeded", lastDeliveryError: null }),
          createProspectActivity({ ownerId: ctx.user.id, prospectId: input.prospectId, action: "handoff_delivered", note: `Expediente entregado explícitamente a ${integration.displayName} mediante webhook firmado.` }),
        ]);
        return { deliveryId, externalReference, destination: integration.displayName };
      } catch (error) {
        const message = error instanceof Error ? error.message : "No se pudo completar la entrega al SaaS.";
        await updateHandoffIntegration(ctx.user.id, { lastDeliveryAt: new Date(), lastDeliveryStatus: "failed", lastDeliveryError: message.slice(0, 1000) });
        throw new TRPCError({ code: "PRECONDITION_FAILED", message });
      }
    }),
    markDelivered: protectedProcedure.input(z.object({ prospectId: z.number().int().positive(), externalReference: z.string().trim().min(2).max(512), note: z.string().trim().max(2000).nullable().optional() })).mutation(async ({ ctx, input }) => {
      if (!ENV.handoffConnectorEnabled || !ENV.handoffWebhookUrl) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "El SaaS externo permanece como placeholder inactivo. Exporta el expediente y registra la entrega manual solo después de configurar y habilitar el conector." });
      const item = await getProspect(ctx.user.id, input.prospectId);
      if (!item) throw new TRPCError({ code: "NOT_FOUND", message: "No se encontró el prospecto." });
      assertNoDemoProspects([item]);
      const handoff = await updateProspectHandoff(ctx.user.id, input.prospectId, { status: "delivered", deliveredAt: new Date(), externalReference: input.externalReference, note: input.note ?? null });
      if (!handoff) throw new TRPCError({ code: "NOT_FOUND", message: "No se encontró la oportunidad en la cola de auditoría." });
      await createProspectActivity({ ownerId: ctx.user.id, prospectId: input.prospectId, action: "handoff_delivered", note: "Se registró la entrega al SaaS externo configurado." });
      return handoff;
    }),
    connectorStatus: protectedProcedure.query(async ({ ctx }) => {
      const integration = await getOrCreateHandoffIntegration(ctx.user.id);
      const enabled = Boolean(integration.isEnabled && integration.webhookUrl && ENV.handoffWebhookSecret);
      return {
        enabled,
        state: enabled ? "activo" : integration.webhookUrl ? "pendiente_de_activacion" : "placeholder_inactivo",
        instructions: "Define la URL HTTPS pública en este panel y añade NEXO_HANDOFF_WEBHOOK_SECRET como secreto del proyecto antes de activar el envío.",
      };
    }),
  }),
  guide: router({
    progress: protectedProcedure.query(({ ctx }) => getOrCreateGuideProgress(ctx.user.id)),
    updateProgress: protectedProcedure.input(z.object({ completedSteps: z.array(z.number().int().min(0).max(4)).max(5) })).mutation(({ ctx, input }) => updateGuideProgress(ctx.user.id, input.completedSteps)),
  }),
  scopeTemplates: router({
    list: protectedProcedure.query(({ ctx }) => getOrCreateWebScopeTemplates(ctx.user.id)),
    create: protectedProcedure.input(scopeTemplateInput).mutation(({ ctx, input }) => createWebScopeTemplate(ctx.user.id, input)),
    update: protectedProcedure.input(scopeTemplateInput.partial().extend({ templateId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const { templateId, ...data } = input;
      const updated = await updateWebScopeTemplate(ctx.user.id, templateId, data);
      if (!updated) throw new TRPCError({ code: "NOT_FOUND", message: "No se encontró la plantilla sectorial." });
      return updated;
    }),
    remove: protectedProcedure.input(z.object({ templateId: z.number().int().positive() })).mutation(({ ctx, input }) => deleteWebScopeTemplate(ctx.user.id, input.templateId)),
  }),
  templates: router({
    list: protectedProcedure.query(({ ctx }) => getOrCreateQualificationTemplates(ctx.user.id)),
    create: protectedProcedure.input(z.object({ name: z.string().trim().min(2).max(120), type: z.enum(["qualification", "contact"]), subject: z.string().trim().max(180).nullable().optional(), body: z.string().trim().min(5).max(10000), isDefault: z.number().int().min(0).max(1).optional() })).mutation(({ ctx, input }) => createQualificationTemplate(ctx.user.id, input)),
    update: protectedProcedure.input(z.object({ templateId: z.number().int().positive(), name: z.string().trim().min(2).max(120).optional(), subject: z.string().trim().max(180).nullable().optional(), body: z.string().trim().min(5).max(10000).optional(), isDefault: z.number().int().min(0).max(1).optional() })).mutation(async ({ ctx, input }) => {
      const { templateId, ...data } = input;
      const updated = await updateQualificationTemplate(ctx.user.id, templateId, data);
      if (!updated) throw new TRPCError({ code: "NOT_FOUND", message: "No se encontró la plantilla." });
      return updated;
    }),
    remove: protectedProcedure.input(z.object({ templateId: z.number().int().positive() })).mutation(({ ctx, input }) => deleteQualificationTemplate(ctx.user.id, input.templateId)),
    render: protectedProcedure.input(z.object({ templateId: z.number().int().positive(), prospectId: z.number().int().positive() })).query(async ({ ctx, input }) => {
      const [templates, item] = await Promise.all([getOrCreateQualificationTemplates(ctx.user.id), getProspect(ctx.user.id, input.prospectId)]);
      const template = templates.find(row => row.id === input.templateId);
      if (!template || !item) throw new TRPCError({ code: "NOT_FOUND", message: "No se encontró la plantilla o el prospecto." });
      const replacements = {
        business_name: item.business.name,
        location: [item.business.city, item.business.region, item.business.country].filter(Boolean).join(", "),
        opportunity_score: String(item.prospect.opportunityScore),
        opportunity_reasons: item.prospect.scoreReasons.map(reason => `• ${reason.label} (${reason.points >= 0 ? "+" : ""}${reason.points})`).join("\n"),
        website: item.business.website ?? "Sin sitio detectado",
        website_status: item.business.websiteStatus,
        sender_name: ctx.user.name ?? "Equipo de Nexo",
      };
      return { templateId: template.id, name: template.name, type: template.type, subject: renderTemplate(template.subject, replacements), body: renderTemplate(template.body, replacements), sending: false };
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

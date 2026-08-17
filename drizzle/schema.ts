import {
  bigint,
  decimal,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

/** Identidad y preferencias de la persona usuaria. */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  avatarUrl: varchar("avatarUrl", { length: 1024 }),
  themePreference: mysqlEnum("themePreference", ["system", "light", "dark"]).default("system").notNull(),
  timezone: varchar("timezone", { length: 64 }).default("UTC").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

/** Configuración reutilizable de una búsqueda de negocios locales. */
export const searchProfiles = mysqlTable("searchProfiles", {
  id: int("id").autoincrement().primaryKey(),
  ownerId: int("ownerId").notNull(),
  name: varchar("name", { length: 120 }).notNull(),
  country: varchar("country", { length: 80 }).notNull(),
  region: varchar("region", { length: 120 }),
  city: varchar("city", { length: 120 }).notNull(),
  district: varchar("district", { length: 120 }),
  referenceAddress: varchar("referenceAddress", { length: 300 }),
  primaryCategory: varchar("primaryCategory", { length: 120 }).notNull(),
  additionalCategories: json("additionalCategories").$type<string[]>(),
  keywords: json("keywords").$type<string[]>(),
  excludedKeywords: json("excludedKeywords").$type<string[]>(),
  radiusMeters: int("radiusMeters").default(5000).notNull(),
  maxResults: int("maxResults").default(20).notNull(),
  minRating: decimal("minRating", { precision: 2, scale: 1 }),
  minReviewCount: int("minReviewCount").default(0).notNull(),
  minOpportunityScore: int("minOpportunityScore").default(0).notNull(),
  websiteMode: mysqlEnum("websiteMode", ["no_website", "with_website", "both"]).default("both").notNull(),
  provider: mysqlEnum("provider", ["google_maps", "csv_import", "manual_entry"]).default("csv_import").notNull(),
  scoringProfileId: int("scoringProfileId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [index("search_profiles_owner_idx").on(table.ownerId)]);

/** Perfil editable que mantiene la fórmula de puntuación fuera del código. */
export const scoringProfiles = mysqlTable("scoringProfiles", {
  id: int("id").autoincrement().primaryKey(),
  ownerId: int("ownerId").notNull(),
  name: varchar("name", { length: 120 }).notNull(),
  isDefault: int("isDefault").default(0).notNull(),
  weights: json("weights").$type<Record<string, number>>().notNull(),
  thresholds: json("thresholds").$type<Record<string, number>>().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [index("scoring_profiles_owner_idx").on(table.ownerId)]);

/** Preferencias comerciales por categoría; no incorpora supuestos de facturación reales. */
export const categoryProfiles = mysqlTable("categoryProfiles", {
  id: int("id").autoincrement().primaryKey(),
  ownerId: int("ownerId").notNull(),
  category: varchar("category", { length: 120 }).notNull(),
  commercialPotential: mysqlEnum("commercialPotential", ["low", "medium", "high", "very_high"]).default("medium").notNull(),
  defaultPriority: mysqlEnum("defaultPriority", ["p0", "p1", "p2", "p3", "ignore"]).default("p2").notNull(),
  recommendedOpportunityTypes: json("recommendedOpportunityTypes").$type<string[]>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [index("category_profiles_owner_idx").on(table.ownerId)]);

/** Límites de consumo explícitos por usuario para detener ejecuciones antes de excederse. */
export const budgetSettings = mysqlTable("budgetSettings", {
  id: int("id").autoincrement().primaryKey(),
  ownerId: int("ownerId").notNull().unique(),
  dailyRequestBudget: int("dailyRequestBudget").default(250).notNull(),
  monthlyRequestBudget: int("monthlyRequestBudget").default(5000).notNull(),
  maxCostPerRunCents: int("maxCostPerRunCents").default(1000).notNull(),
  maxBusinessesPerRun: int("maxBusinessesPerRun").default(50).notNull(),
  maxAiCallsPerRun: int("maxAiCallsPerRun").default(0).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/** Una ejecución de prospección y su configuración inmutable. */
export const prospectingRuns = mysqlTable("prospectingRuns", {
  id: int("id").autoincrement().primaryKey(),
  ownerId: int("ownerId").notNull(),
  publicId: varchar("publicId", { length: 32 }).notNull().unique(),
  status: mysqlEnum("status", ["queued", "running", "paused", "completed", "partial", "failed", "cancelled"]).default("queued").notNull(),
  provider: mysqlEnum("provider", ["google_maps", "csv_import", "manual_entry"]).default("csv_import").notNull(),
  query: varchar("query", { length: 300 }).notNull(),
  country: varchar("country", { length: 80 }).notNull(),
  region: varchar("region", { length: 120 }),
  city: varchar("city", { length: 120 }).notNull(),
  district: varchar("district", { length: 120 }),
  referenceAddress: varchar("referenceAddress", { length: 300 }),
  latitude: decimal("latitude", { precision: 10, scale: 7 }),
  longitude: decimal("longitude", { precision: 10, scale: 7 }),
  radiusMeters: int("radiusMeters").notNull(),
  primaryCategory: varchar("primaryCategory", { length: 120 }).notNull(),
  keywords: json("keywords").$type<string[]>(),
  excludedKeywords: json("excludedKeywords").$type<string[]>(),
  websiteMode: mysqlEnum("websiteMode", ["no_website", "with_website", "both"]).default("both").notNull(),
  maxResults: int("maxResults").notNull(),
  minRating: decimal("minRating", { precision: 2, scale: 1 }),
  minReviewCount: int("minReviewCount").default(0).notNull(),
  minOpportunityScore: int("minOpportunityScore").default(0).notNull(),
  scoringSnapshot: json("scoringSnapshot").$type<Record<string, number>>().notNull(),
  estimatedOperations: int("estimatedOperations").default(0).notNull(),
  estimatedCostCents: int("estimatedCostCents").default(0).notNull(),
  foundCount: int("foundCount").default(0).notNull(),
  uniqueCount: int("uniqueCount").default(0).notNull(),
  qualifiedCount: int("qualifiedCount").default(0).notNull(),
  rejectedCount: int("rejectedCount").default(0).notNull(),
  errorCount: int("errorCount").default(0).notNull(),
  startedAt: timestamp("startedAt"),
  finishedAt: timestamp("finishedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("runs_owner_created_idx").on(table.ownerId, table.createdAt), index("runs_status_idx").on(table.status)]);

/** Datos originales del proveedor: nunca se eliminan al normalizar. */
export const rawSearchResults = mysqlTable("rawSearchResults", {
  id: int("id").autoincrement().primaryKey(),
  runId: int("runId").notNull(),
  provider: varchar("provider", { length: 64 }).notNull(),
  providerRecordId: varchar("providerRecordId", { length: 255 }).notNull(),
  query: varchar("query", { length: 300 }).notNull(),
  payload: json("payload").$type<Record<string, unknown>>().notNull(),
  receivedAt: timestamp("receivedAt").defaultNow().notNull(),
}, table => [index("raw_results_run_idx").on(table.runId), index("raw_results_provider_id_idx").on(table.provider, table.providerRecordId)]);

/** Negocio normalizado a partir de información empresarial y pública permitida. */
export const businesses = mysqlTable("businesses", {
  id: int("id").autoincrement().primaryKey(),
  ownerId: int("ownerId").notNull(),
  source: varchar("source", { length: 64 }).notNull(),
  externalId: varchar("externalId", { length: 255 }).notNull(),
  deduplicationKey: varchar("deduplicationKey", { length: 512 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  category: varchar("category", { length: 120 }),
  categories: json("categories").$type<string[]>(),
  address: varchar("address", { length: 500 }),
  city: varchar("city", { length: 120 }),
  region: varchar("region", { length: 120 }),
  country: varchar("country", { length: 80 }),
  postalCode: varchar("postalCode", { length: 32 }),
  latitude: decimal("latitude", { precision: 10, scale: 7 }),
  longitude: decimal("longitude", { precision: 10, scale: 7 }),
  phone: varchar("phone", { length: 64 }),
  website: varchar("website", { length: 1024 }),
  domain: varchar("domain", { length: 255 }),
  googleMapsUrl: varchar("googleMapsUrl", { length: 2048 }),
  rating: decimal("rating", { precision: 2, scale: 1 }),
  reviewCount: int("reviewCount"),
  businessStatus: varchar("businessStatus", { length: 64 }),
  websiteStatus: mysqlEnum("websiteStatus", ["no_website", "website_found", "website_unreachable", "website_unknown"]).default("website_unknown").notNull(),
  websiteQuality: mysqlEnum("websiteQuality", ["excellent", "good", "average", "weak", "very_weak", "broken", "not_analyzed"]),
  websiteSignals: json("websiteSignals").$type<Record<string, boolean | number | string | null>>(),
  socialProfiles: json("socialProfiles").$type<Record<string, string>>(),
  bookingUrl: varchar("bookingUrl", { length: 2048 }),
  whatsappUrl: varchar("whatsappUrl", { length: 2048 }),
  isDemo: int("isDemo").default(0).notNull(),
  dataQualityScore: int("dataQualityScore").default(0).notNull(),
  sourceTimestamp: timestamp("sourceTimestamp").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [
  index("businesses_owner_external_idx").on(table.ownerId, table.externalId),
  index("businesses_owner_dedupe_idx").on(table.ownerId, table.deduplicationKey),
  index("businesses_owner_city_idx").on(table.ownerId, table.city),
]);

/** Resultado de la evaluación de un negocio dentro de una ejecución concreta. */
export const runProspects = mysqlTable("runProspects", {
  id: int("id").autoincrement().primaryKey(),
  runId: int("runId").notNull(),
  businessId: int("businessId").notNull(),
  status: mysqlEnum("status", ["new", "qualified", "rejected", "exported", "analysis_pending", "analyzed", "demo_pending", "contact_pending", "contacted", "converted", "lost"]).default("new").notNull(),
  duplicateConfidence: mysqlEnum("duplicateConfidence", ["exact", "high", "medium", "low"]).default("exact").notNull(),
  opportunityScore: int("opportunityScore").default(0).notNull(),
  businessAttractivenessScore: int("businessAttractivenessScore").default(0).notNull(),
  digitalOpportunityScore: int("digitalOpportunityScore").default(0).notNull(),
  websiteOpportunityScore: int("websiteOpportunityScore").default(0).notNull(),
  leadPotentialScore: int("leadPotentialScore").default(0).notNull(),
  commercialPotentialScore: int("commercialPotentialScore").default(0).notNull(),
  urgencyScore: int("urgencyScore").default(0).notNull(),
  priority: mysqlEnum("priority", ["p0", "p1", "p2", "p3", "ignore"]).default("ignore").notNull(),
  opportunityTypes: json("opportunityTypes").$type<string[]>(),
  scoreReasons: json("scoreReasons").$type<Array<{ label: string; points: number }>>().notNull(),
  analysisSummary: text("analysisSummary"),
  analysisConfidence: decimal("analysisConfidence", { precision: 3, scale: 2 }),
  notes: text("notes"),
  nextActionLabel: varchar("nextActionLabel", { length: 240 }),
  nextActionAt: timestamp("nextActionAt"),
  lastContactedAt: timestamp("lastContactedAt"),
  lastCheckedAt: timestamp("lastCheckedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [
  index("run_prospects_run_idx").on(table.runId),
  index("run_prospects_business_idx").on(table.businessId),
  index("run_prospects_priority_idx").on(table.priority),
]);

/** Log auditable de progreso, errores recuperables y consumo de cada ejecución. */
export const runEvents = mysqlTable("runEvents", {
  id: int("id").autoincrement().primaryKey(),
  runId: int("runId").notNull(),
  stage: mysqlEnum("stage", ["plan", "search", "details", "normalize", "deduplicate", "score", "export", "budget"]).notNull(),
  level: mysqlEnum("level", ["info", "warning", "error"]).default("info").notNull(),
  message: varchar("message", { length: 500 }).notNull(),
  errorCode: varchar("errorCode", { length: 80 }),
  retryCount: int("retryCount").default(0).notNull(),
  recoverable: int("recoverable").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("run_events_run_created_idx").on(table.runId, table.createdAt)]);

/** Contabiliza solicitudes estimadas y reales sin guardar secretos de proveedor. */
export const usageRecords = mysqlTable("usageRecords", {
  id: int("id").autoincrement().primaryKey(),
  ownerId: int("ownerId").notNull(),
  runId: int("runId"),
  provider: varchar("provider", { length: 64 }).notNull(),
  operation: varchar("operation", { length: 80 }).notNull(),
  requestCount: int("requestCount").default(0).notNull(),
  estimatedCostCents: int("estimatedCostCents").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("usage_owner_created_idx").on(table.ownerId, table.createdAt)]);

/** Auditoría de entregas de prospectos a destinos externos autorizados. */
export const prospectExports = mysqlTable("prospectExports", {
  id: int("id").autoincrement().primaryKey(),
  ownerId: int("ownerId").notNull(),
  prospectId: int("prospectId").notNull(),
  destination: mysqlEnum("destination", ["google_sheets"]).notNull(),
  destinationLabel: varchar("destinationLabel", { length: 160 }).notNull(),
  externalReference: varchar("externalReference", { length: 512 }),
  status: mysqlEnum("status", ["succeeded", "failed"]).notNull(),
  errorMessage: varchar("errorMessage", { length: 1000 }),
  exportedAt: timestamp("exportedAt").defaultNow().notNull(),
}, table => [index("prospect_exports_owner_idx").on(table.ownerId, table.exportedAt), index("prospect_exports_prospect_idx").on(table.prospectId)]);

/** Bitácora interna de cada cambio comercial y próxima acción de un prospecto. */
export const prospectActivities = mysqlTable("prospectActivities", {
  id: int("id").autoincrement().primaryKey(),
  ownerId: int("ownerId").notNull(),
  prospectId: int("prospectId").notNull(),
  action: varchar("action", { length: 80 }).notNull(),
  note: text("note"),
  previousStatus: varchar("previousStatus", { length: 40 }),
  nextStatus: varchar("nextStatus", { length: 40 }),
  nextActionLabel: varchar("nextActionLabel", { length: 240 }),
  nextActionAt: timestamp("nextActionAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("prospect_activities_prospect_created_idx").on(table.prospectId, table.createdAt), index("prospect_activities_owner_idx").on(table.ownerId, table.createdAt)]);

/** Política configurable para decidir qué oportunidades pasan a auditoría o creación web. */
export const handoffPolicies = mysqlTable("handoffPolicies", {
  id: int("id").autoincrement().primaryKey(),
  ownerId: int("ownerId").notNull().unique(),
  minimumOpportunityScore: int("minimumOpportunityScore").default(70).notNull(),
  requireNextAction: int("requireNextAction").default(1).notNull(),
  requireDigitalEvidence: int("requireDigitalEvidence").default(1).notNull(),
  destinationLabel: varchar("destinationLabel", { length: 160 }).default("SaaS de auditoría web").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/** Cola interna de oportunidades aprobadas para la siguiente fase de auditoría. */
export const prospectHandoffs = mysqlTable("prospectHandoffs", {
  id: int("id").autoincrement().primaryKey(),
  ownerId: int("ownerId").notNull(),
  prospectId: int("prospectId").notNull().unique(),
  status: mysqlEnum("status", ["ready_for_review", "approved", "package_exported", "delivered", "returned"]).default("ready_for_review").notNull(),
  destinationLabel: varchar("destinationLabel", { length: 160 }).notNull(),
  eligibilitySnapshot: json("eligibilitySnapshot").$type<Record<string, unknown>>().notNull(),
  approvedAt: timestamp("approvedAt"),
  packageExportedAt: timestamp("packageExportedAt"),
  deliveredAt: timestamp("deliveredAt"),
  externalReference: varchar("externalReference", { length: 512 }),
  note: text("note"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [index("prospect_handoffs_owner_status_idx").on(table.ownerId, table.status), index("prospect_handoffs_prospect_idx").on(table.prospectId)]);

/** Historial de análisis técnico sobre un sitio público indicado por el propio negocio. */
export const websiteAnalyses = mysqlTable("websiteAnalyses", {
  id: int("id").autoincrement().primaryKey(),
  ownerId: int("ownerId").notNull(),
  prospectId: int("prospectId").notNull(),
  provider: mysqlEnum("provider", ["pagespeed_insights"]).default("pagespeed_insights").notNull(),
  url: varchar("url", { length: 2048 }).notNull(),
  strategy: mysqlEnum("strategy", ["mobile", "desktop"]).default("mobile").notNull(),
  status: mysqlEnum("status", ["completed", "failed", "skipped"]).notNull(),
  performanceScore: int("performanceScore"),
  accessibilityScore: int("accessibilityScore"),
  bestPracticesScore: int("bestPracticesScore"),
  seoScore: int("seoScore"),
  signals: json("signals").$type<Record<string, boolean | number | string | null>>(),
  summary: text("summary"),
  errorMessage: varchar("errorMessage", { length: 1000 }),
  analyzedAt: timestamp("analyzedAt").defaultNow().notNull(),
}, table => [index("website_analyses_prospect_idx").on(table.prospectId, table.analyzedAt)]);

/** Plantillas controladas por cada cuenta para cualificación y contacto, sin envío automático. */
export const qualificationTemplates = mysqlTable("qualificationTemplates", {
  id: int("id").autoincrement().primaryKey(),
  ownerId: int("ownerId").notNull(),
  name: varchar("name", { length: 120 }).notNull(),
  type: mysqlEnum("type", ["qualification", "contact"]).notNull(),
  subject: varchar("subject", { length: 180 }),
  body: text("body").notNull(),
  isDefault: int("isDefault").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [index("qualification_templates_owner_type_idx").on(table.ownerId, table.type)]);

/**
 * Tablas heredadas del primer prototipo. Se conservan temporalmente para no
 * destruir información durante la reconstrucción; el scanner no las utiliza.
 */
export const projects = mysqlTable("projects", {
  id: int("id").autoincrement().primaryKey(),
  ownerId: int("ownerId").notNull(),
  name: varchar("name", { length: 160 }).notNull(),
  description: text("description"),
  status: mysqlEnum("status", ["active", "paused", "completed"]).default("active").notNull(),
  dueDate: timestamp("dueDate"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [index("projects_owner_idx").on(table.ownerId), index("projects_status_idx").on(table.status)]);

export const projectMembers = mysqlTable("projectMembers", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  userId: int("userId").notNull(),
  role: mysqlEnum("role", ["owner", "member"]).default("member").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("project_members_project_idx").on(table.projectId), index("project_members_user_idx").on(table.userId)]);

export const tasks = mysqlTable("tasks", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  creatorId: int("creatorId").notNull(),
  assigneeId: int("assigneeId"),
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description"),
  priority: mysqlEnum("priority", ["low", "medium", "high", "urgent"]).default("medium").notNull(),
  status: mysqlEnum("status", ["todo", "in_progress", "done"]).default("todo").notNull(),
  dueDate: timestamp("dueDate"),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [index("tasks_project_idx").on(table.projectId), index("tasks_assignee_idx").on(table.assigneeId), index("tasks_status_idx").on(table.status)]);

export const projectFiles = mysqlTable("projectFiles", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  uploadedById: int("uploadedById").notNull(),
  originalName: varchar("originalName", { length: 255 }).notNull(),
  storageKey: varchar("storageKey", { length: 512 }).notNull(),
  storageUrl: varchar("storageUrl", { length: 1024 }).notNull(),
  mimeType: varchar("mimeType", { length: 127 }).notNull(),
  sizeBytes: bigint("sizeBytes", { mode: "number" }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("project_files_project_idx").on(table.projectId)]);

export const activities = mysqlTable("activities", {
  id: int("id").autoincrement().primaryKey(),
  actorId: int("actorId").notNull(),
  projectId: int("projectId"),
  entityType: mysqlEnum("entityType", ["project", "task", "file", "profile", "admin"]).notNull(),
  entityId: int("entityId"),
  action: varchar("action", { length: 80 }).notNull(),
  summary: varchar("summary", { length: 300 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("activities_actor_idx").on(table.actorId), index("activities_project_idx").on(table.projectId), index("activities_created_idx").on(table.createdAt)]);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type SearchProfile = typeof searchProfiles.$inferSelect;
export type ScoringProfile = typeof scoringProfiles.$inferSelect;
export type BudgetSettings = typeof budgetSettings.$inferSelect;
export type ProspectingRun = typeof prospectingRuns.$inferSelect;
export type Business = typeof businesses.$inferSelect;
export type RunProspect = typeof runProspects.$inferSelect;

import { and, desc, eq, gte, inArray, isNull, like, lt, lte, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  activities,
  budgetSettings,
  businesses,
  categoryProfiles,
  handoffIntegrations,
  handoffPolicies,
  InsertUser,
  prospectingRuns,
  projectFiles,
  projects,
  projectMembers,
  prospectActivities,
  prospectExports,
  prospectHandoffs,
  rawSearchResults,
  runEvents,
  runProspects,
  qualificationTemplates,
  scoringProfiles,
  searchProfiles,
  tasks,
  usageRecords,
  userGuideProgress,
  users,
  websiteAnalyses,
  webScopeTemplates,
} from "../drizzle/schema";
import { DEFAULT_SCORING_THRESHOLDS, DEFAULT_SCORING_WEIGHTS } from "./scoring";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId, lastSignedIn: new Date() };
  const updateSet: Record<string, unknown> = { lastSignedIn: new Date() };
  const textFields = ["name", "email", "loginMethod"] as const;

  textFields.forEach(field => {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  });

  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function getUserById(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return result[0];
}

export async function updateUserProfile(
  userId: number,
  data: { name?: string | null; avatarUrl?: string | null; themePreference?: "system" | "light" | "dark"; timezone?: string }
) {
  const db = await getDb();
  if (!db) return undefined;
  await db.update(users).set(data).where(eq(users.id, userId));
  return getUserById(userId);
}

export async function listProjectsForUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(projects)
    .where(
      or(
        eq(projects.ownerId, userId),
        inArray(
          projects.id,
          db.select({ projectId: projectMembers.projectId }).from(projectMembers).where(eq(projectMembers.userId, userId))
        )
      )
    )
    .orderBy(desc(projects.updatedAt));
}

export async function getProjectForUser(projectId: number, userId: number) {
  const accessible = await listProjectsForUser(userId);
  return accessible.find(project => project.id === projectId);
}

export async function isProjectMember(projectId: number, userId: number) {
  const db = await getDb();
  if (!db) return false;
  const result = await db
    .select({ id: projectMembers.id })
    .from(projectMembers)
    .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)))
    .limit(1);
  return result.length > 0;
}

export async function listProjectMembers(projectId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      userId: users.id,
      name: users.name,
      email: users.email,
      avatarUrl: users.avatarUrl,
      role: projectMembers.role,
    })
    .from(projectMembers)
    .innerJoin(users, eq(projectMembers.userId, users.id))
    .where(eq(projectMembers.projectId, projectId));
}

export async function addProjectMember(projectId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("La base de datos no está disponible.");
  if (await isProjectMember(projectId, userId)) return false;
  await db.insert(projectMembers).values({ projectId, userId, role: "member" });
  return true;
}

export async function listAssignableUsers() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({ id: users.id, name: users.name, email: users.email, avatarUrl: users.avatarUrl })
    .from(users)
    .orderBy(desc(users.lastSignedIn));
}

export async function createProject(data: {
  ownerId: number;
  name: string;
  description?: string | null;
  status?: "active" | "paused" | "completed";
  dueDate?: Date | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("La base de datos no está disponible.");
  const result = await db.insert(projects).values(data);
  const projectId = Number(result[0].insertId);
  await db.insert(projectMembers).values({ projectId, userId: data.ownerId, role: "owner" });
  return (await db.select().from(projects).where(eq(projects.id, projectId)).limit(1))[0];
}

export async function updateProject(projectId: number, data: Partial<{
  name: string;
  description: string | null;
  status: "active" | "paused" | "completed";
  dueDate: Date | null;
}>) {
  const db = await getDb();
  if (!db) throw new Error("La base de datos no está disponible.");
  await db.update(projects).set(data).where(eq(projects.id, projectId));
  return (await db.select().from(projects).where(eq(projects.id, projectId)).limit(1))[0];
}

export async function deleteProject(projectId: number) {
  const db = await getDb();
  if (!db) throw new Error("La base de datos no está disponible.");
  await db.delete(activities).where(eq(activities.projectId, projectId));
  await db.delete(projectFiles).where(eq(projectFiles.projectId, projectId));
  await db.delete(tasks).where(eq(tasks.projectId, projectId));
  await db.delete(projectMembers).where(eq(projectMembers.projectId, projectId));
  await db.delete(projects).where(eq(projects.id, projectId));
}

export async function listTasksForProject(
  projectId: number,
  filters?: { status?: "todo" | "in_progress" | "done"; priority?: "low" | "medium" | "high" | "urgent"; query?: string }
) {
  const db = await getDb();
  if (!db) return [];
  const predicates = [eq(tasks.projectId, projectId)];
  if (filters?.status) predicates.push(eq(tasks.status, filters.status));
  if (filters?.priority) predicates.push(eq(tasks.priority, filters.priority));
  if (filters?.query?.trim()) {
    predicates.push(or(like(tasks.title, `%${filters.query.trim()}%`), like(tasks.description, `%${filters.query.trim()}%`))!);
  }
  return db.select().from(tasks).where(and(...predicates)).orderBy(desc(tasks.updatedAt));
}

export async function createTask(data: {
  projectId: number;
  creatorId: number;
  assigneeId?: number | null;
  title: string;
  description?: string | null;
  priority?: "low" | "medium" | "high" | "urgent";
  status?: "todo" | "in_progress" | "done";
  dueDate?: Date | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("La base de datos no está disponible.");
  const result = await db.insert(tasks).values(data);
  const taskId = Number(result[0].insertId);
  return (await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1))[0];
}

export async function updateTask(taskId: number, data: Partial<{
  assigneeId: number | null;
  title: string;
  description: string | null;
  priority: "low" | "medium" | "high" | "urgent";
  status: "todo" | "in_progress" | "done";
  dueDate: Date | null;
  completedAt: Date | null;
}>) {
  const db = await getDb();
  if (!db) throw new Error("La base de datos no está disponible.");
  await db.update(tasks).set(data).where(eq(tasks.id, taskId));
  return (await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1))[0];
}

export async function deleteTask(taskId: number) {
  const db = await getDb();
  if (!db) throw new Error("La base de datos no está disponible.");
  await db.delete(tasks).where(eq(tasks.id, taskId));
}

export async function getTaskById(taskId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
  return result[0];
}

export async function createActivity(data: {
  actorId: number;
  projectId?: number | null;
  entityType: "project" | "task" | "file" | "profile" | "admin";
  entityId?: number | null;
  action: string;
  summary: string;
}) {
  const db = await getDb();
  if (!db) return;
  await db.insert(activities).values(data);
}

export async function listActivitiesForUser(userId: number, limit = 40) {
  const db = await getDb();
  if (!db) return [];
  const accessible = await listProjectsForUser(userId);
  const projectIds = accessible.map(project => project.id);
  return db
    .select({ activity: activities, actorName: users.name, actorAvatar: users.avatarUrl })
    .from(activities)
    .leftJoin(users, eq(activities.actorId, users.id))
    .where(projectIds.length ? or(eq(activities.actorId, userId), inArray(activities.projectId, projectIds)) : eq(activities.actorId, userId))
    .orderBy(desc(activities.createdAt))
    .limit(limit);
}

export async function listFilesForProject(projectId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(projectFiles).where(eq(projectFiles.projectId, projectId)).orderBy(desc(projectFiles.createdAt));
}

export async function createProjectFile(data: {
  projectId: number;
  uploadedById: number;
  originalName: string;
  storageKey: string;
  storageUrl: string;
  mimeType: string;
  sizeBytes: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("La base de datos no está disponible.");
  const result = await db.insert(projectFiles).values(data);
  const fileId = Number(result[0].insertId);
  return (await db.select().from(projectFiles).where(eq(projectFiles.id, fileId)).limit(1))[0];
}

export async function getProjectFileById(fileId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(projectFiles).where(eq(projectFiles.id, fileId)).limit(1);
  return result[0];
}

export async function deleteProjectFile(fileId: number) {
  const db = await getDb();
  if (!db) throw new Error("La base de datos no está disponible.");
  await db.delete(projectFiles).where(eq(projectFiles.id, fileId));
}

export async function listUsers() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(users).orderBy(desc(users.lastSignedIn));
}

export async function updateUserRole(userId: number, role: "admin" | "user") {
  const db = await getDb();
  if (!db) throw new Error("La base de datos no está disponible.");
  await db.update(users).set({ role }).where(eq(users.id, userId));
  return getUserById(userId);
}

export async function getDashboardMetrics(userId: number) {
  const db = await getDb();
  if (!db) return { activeProjects: 0, pendingTasks: 0, completedTasks: 0, overdueTasks: 0 };
  const accessibleProjects = await listProjectsForUser(userId);
  const projectIds = accessibleProjects.map(project => project.id);
  if (!projectIds.length) return { activeProjects: 0, pendingTasks: 0, completedTasks: 0, overdueTasks: 0 };
  const rows = await db.select().from(tasks).where(inArray(tasks.projectId, projectIds));
  const now = new Date();
  return {
    activeProjects: accessibleProjects.filter(project => project.status === "active").length,
    pendingTasks: rows.filter(task => task.status !== "done").length,
    completedTasks: rows.filter(task => task.status === "done").length,
    overdueTasks: rows.filter(task => task.status !== "done" && task.dueDate && task.dueDate < now).length,
  };
}

export async function getOrCreateBudgetSettings(ownerId: number) {
  const db = await getDb();
  if (!db) throw new Error("La base de datos no está disponible.");
  const existing = await db.select().from(budgetSettings).where(eq(budgetSettings.ownerId, ownerId)).limit(1);
  if (existing[0]) return existing[0];
  await db.insert(budgetSettings).values({ ownerId });
  return (await db.select().from(budgetSettings).where(eq(budgetSettings.ownerId, ownerId)).limit(1))[0]!;
}

export async function updateBudgetSettings(ownerId: number, data: Partial<{
  dailyRequestBudget: number;
  monthlyRequestBudget: number;
  maxCostPerRunCents: number;
  maxBusinessesPerRun: number;
  maxAiCallsPerRun: number;
}>) {
  const db = await getDb();
  if (!db) throw new Error("La base de datos no está disponible.");
  await getOrCreateBudgetSettings(ownerId);
  await db.update(budgetSettings).set(data).where(eq(budgetSettings.ownerId, ownerId));
  return getOrCreateBudgetSettings(ownerId);
}

export async function getOrCreateDefaultScoringProfile(ownerId: number) {
  const db = await getDb();
  if (!db) throw new Error("La base de datos no está disponible.");
  const existing = await db.select().from(scoringProfiles).where(and(eq(scoringProfiles.ownerId, ownerId), eq(scoringProfiles.isDefault, 1))).limit(1);
  if (existing[0]) return existing[0];
  const result = await db.insert(scoringProfiles).values({
    ownerId,
    name: "Puntuación base",
    isDefault: 1,
    weights: DEFAULT_SCORING_WEIGHTS,
    thresholds: DEFAULT_SCORING_THRESHOLDS,
  });
  return (await db.select().from(scoringProfiles).where(eq(scoringProfiles.id, Number(result[0].insertId))).limit(1))[0]!;
}

export async function listScoringProfiles(ownerId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(scoringProfiles).where(eq(scoringProfiles.ownerId, ownerId)).orderBy(desc(scoringProfiles.updatedAt));
}

export async function updateScoringProfile(ownerId: number, profileId: number, data: Partial<{ name: string; weights: Record<string, number>; thresholds: Record<string, number> }>) {
  const db = await getDb();
  if (!db) throw new Error("La base de datos no está disponible.");
  await db.update(scoringProfiles).set(data).where(and(eq(scoringProfiles.id, profileId), eq(scoringProfiles.ownerId, ownerId)));
  return (await db.select().from(scoringProfiles).where(and(eq(scoringProfiles.id, profileId), eq(scoringProfiles.ownerId, ownerId))).limit(1))[0];
}

export async function listSearchProfiles(ownerId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(searchProfiles).where(eq(searchProfiles.ownerId, ownerId)).orderBy(desc(searchProfiles.updatedAt));
}

export type AuthorizedProfileSource = "google_maps" | "csv_import" | "manual_entry";

export type SearchProfileInput = {
  name: string;
  country: string;
  city: string;
  district?: string | null;
  referenceAddress?: string | null;
  primaryCategory: string;
  keywords?: string[];
  excludedKeywords?: string[];
  radiusMeters: number;
  maxResults: number;
  minRating?: number | null;
  minReviewCount: number;
  minOpportunityScore: number;
  websiteMode: "no_website" | "with_website" | "both";
  provider: AuthorizedProfileSource;
};

export function buildSearchProfileValues(ownerId: number, data: SearchProfileInput) {
  return {
    ...data,
    ownerId,
    minRating: data.minRating === null || data.minRating === undefined ? null : String(data.minRating),
  };
}

export async function createSearchProfile(ownerId: number, data: SearchProfileInput) {
  const db = await getDb();
  if (!db) throw new Error("La base de datos no está disponible.");
  const result = await db.insert(searchProfiles).values(buildSearchProfileValues(ownerId, data));
  return (await db.select().from(searchProfiles).where(eq(searchProfiles.id, Number(result[0].insertId))).limit(1))[0]!;
}

export async function getUsageSummary(ownerId: number) {
  const db = await getDb();
  if (!db) return { dailyRequests: 0, monthlyRequests: 0, monthlyCostCents: 0 };
  const rows = await db.select().from(usageRecords).where(eq(usageRecords.ownerId, ownerId));
  const now = new Date();
  const startDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  return rows.reduce(
    (summary, row) => ({
      dailyRequests: summary.dailyRequests + (row.createdAt >= startDay ? row.requestCount : 0),
      monthlyRequests: summary.monthlyRequests + (row.createdAt >= startMonth ? row.requestCount : 0),
      monthlyCostCents: summary.monthlyCostCents + (row.createdAt >= startMonth ? row.estimatedCostCents : 0),
    }),
    { dailyRequests: 0, monthlyRequests: 0, monthlyCostCents: 0 }
  );
}

export async function createProspectingRun(data: {
  ownerId: number; publicId: string; query: string; country: string; city: string; district?: string | null; referenceAddress?: string | null;
  provider?: "google_maps" | "csv_import" | "manual_entry";
  radiusMeters: number; primaryCategory: string; keywords?: string[] | null; excludedKeywords?: string[] | null; websiteMode?: "no_website" | "with_website" | "both";
  maxResults: number; minRating?: number | null; minReviewCount: number; minOpportunityScore: number; scoringSnapshot: Record<string, number>;
  estimatedOperations: number; estimatedCostCents: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("La base de datos no está disponible.");
  const result = await db.insert(prospectingRuns).values({
    ...data,
    minRating: data.minRating === null || data.minRating === undefined ? null : String(data.minRating),
  });
  return (await db.select().from(prospectingRuns).where(eq(prospectingRuns.id, Number(result[0].insertId))).limit(1))[0]!;
}

export async function updateProspectingRun(runId: number, ownerId: number, data: Partial<{
  status: "queued" | "running" | "paused" | "completed" | "partial" | "failed" | "cancelled";
  foundCount: number; uniqueCount: number; qualifiedCount: number; rejectedCount: number; errorCount: number; startedAt: Date | null; finishedAt: Date | null;
}>) {
  const db = await getDb();
  if (!db) throw new Error("La base de datos no está disponible.");
  await db.update(prospectingRuns).set(data).where(and(eq(prospectingRuns.id, runId), eq(prospectingRuns.ownerId, ownerId)));
  return getProspectingRun(runId, ownerId);
}

export async function getProspectingRun(runId: number, ownerId: number) {
  const db = await getDb();
  if (!db) return undefined;
  return (await db.select().from(prospectingRuns).where(and(eq(prospectingRuns.id, runId), eq(prospectingRuns.ownerId, ownerId))).limit(1))[0];
}

export async function listProspectingRuns(ownerId: number, limit = 30) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(prospectingRuns).where(eq(prospectingRuns.ownerId, ownerId)).orderBy(desc(prospectingRuns.createdAt)).limit(limit);
}

export async function createRunEvent(data: { runId: number; stage: "plan" | "search" | "details" | "normalize" | "deduplicate" | "score" | "export" | "budget"; level?: "info" | "warning" | "error"; message: string; errorCode?: string | null; recoverable?: number }) {
  const db = await getDb();
  if (!db) return;
  await db.insert(runEvents).values(data);
}

export async function listRunEvents(runId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(runEvents).where(eq(runEvents.runId, runId)).orderBy(desc(runEvents.createdAt));
}

export async function createUsageRecord(data: { ownerId: number; runId?: number | null; provider: string; operation: string; requestCount: number; estimatedCostCents?: number }) {
  const db = await getDb();
  if (!db) return;
  await db.insert(usageRecords).values(data);
}

export async function upsertBusinessFromProvider(data: {
  ownerId: number; source: string; externalId: string; deduplicationKey: string; name: string; category?: string | null; categories?: string[] | null;
  address?: string | null; city?: string | null; region?: string | null; country?: string | null; latitude?: number | null; longitude?: number | null;
  phone?: string | null; website?: string | null; domain?: string | null; googleMapsUrl?: string | null; rating?: number | null; reviewCount?: number | null;
  businessStatus?: string | null; isDemo?: 0 | 1; websiteStatus: "no_website" | "website_found" | "website_unreachable" | "website_unknown"; dataQualityScore: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("La base de datos no está disponible.");
  const found = await db.select().from(businesses).where(and(eq(businesses.ownerId, data.ownerId), eq(businesses.source, data.source), eq(businesses.externalId, data.externalId))).limit(1);
  const values = {
    ...data,
    latitude: data.latitude === null || data.latitude === undefined ? null : String(data.latitude),
    longitude: data.longitude === null || data.longitude === undefined ? null : String(data.longitude),
    rating: data.rating === null || data.rating === undefined ? null : String(data.rating),
    sourceTimestamp: new Date(),
  };
  if (found[0]) {
    await db.update(businesses).set(values).where(eq(businesses.id, found[0].id));
    return { business: (await db.select().from(businesses).where(eq(businesses.id, found[0].id)).limit(1))[0]!, isKnown: true };
  }
  const inserted = await db.insert(businesses).values(values);
  return { business: (await db.select().from(businesses).where(eq(businesses.id, Number(inserted[0].insertId))).limit(1))[0]!, isKnown: false };
}

export async function createRawSearchResult(data: { runId: number; provider: string; providerRecordId: string; query: string; payload: Record<string, unknown> }) {
  const db = await getDb();
  if (!db) return;
  await db.insert(rawSearchResults).values(data);
}

export async function createRunProspect(data: {
  runId: number; businessId: number; duplicateConfidence?: "exact" | "high" | "medium" | "low"; status?: "new" | "qualified" | "rejected";
  opportunityScore: number; businessAttractivenessScore: number; digitalOpportunityScore: number; websiteOpportunityScore: number; leadPotentialScore: number; commercialPotentialScore: number; urgencyScore: number;
  priority: "p0" | "p1" | "p2" | "p3" | "ignore"; opportunityTypes: string[]; scoreReasons: Array<{ label: string; points: number }>; analysisSummary: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("La base de datos no está disponible.");
  const result = await db.insert(runProspects).values(data);
  return (await db.select().from(runProspects).where(eq(runProspects.id, Number(result[0].insertId))).limit(1))[0]!;
}

export type ProspectListFilters = { runId?: number; priority?: "p0" | "p1" | "p2" | "p3" | "ignore"; status?: "new" | "qualified" | "rejected" | "exported" | "analysis_pending" | "analyzed" | "demo_pending" | "contact_pending" | "contacted" | "converted" | "lost"; websiteStatus?: "no_website" | "website_found" | "website_unreachable" | "website_unknown"; dueState?: "overdue" | "today" | "upcoming" | "none"; minimumScore?: number; query?: string; limit?: number };

export async function listProspects(ownerId: number, filters?: ProspectListFilters) {
  const db = await getDb();
  if (!db) return [];
  const predicates = [eq(businesses.ownerId, ownerId)];
  if (filters?.runId) predicates.push(eq(runProspects.runId, filters.runId));
  if (filters?.priority) predicates.push(eq(runProspects.priority, filters.priority));
  if (filters?.status) predicates.push(eq(runProspects.status, filters.status));
  if (filters?.websiteStatus) predicates.push(eq(businesses.websiteStatus, filters.websiteStatus));
  if (filters?.minimumScore !== undefined) predicates.push(sql`${runProspects.opportunityScore} >= ${filters.minimumScore}`);
  if (filters?.query) predicates.push(or(like(businesses.name, `%${filters.query.trim()}%`), like(businesses.city, `%${filters.query.trim()}%`))!);
  const now = new Date();
  const endOfToday = new Date(now); endOfToday.setHours(23, 59, 59, 999);
  const upcomingEnd = new Date(now.getTime() + 72 * 60 * 60 * 1000);
  if (filters?.dueState === "overdue") predicates.push(lt(runProspects.nextActionAt, now));
  if (filters?.dueState === "today") predicates.push(and(gte(runProspects.nextActionAt, now), lte(runProspects.nextActionAt, endOfToday))!);
  if (filters?.dueState === "upcoming") predicates.push(and(gte(runProspects.nextActionAt, now), lte(runProspects.nextActionAt, upcomingEnd))!);
  if (filters?.dueState === "none") predicates.push(isNull(runProspects.nextActionAt));
  return db.select({ prospect: runProspects, business: businesses, run: prospectingRuns }).from(runProspects).innerJoin(businesses, eq(runProspects.businessId, businesses.id)).innerJoin(prospectingRuns, eq(runProspects.runId, prospectingRuns.id)).where(and(...predicates)).orderBy(desc(runProspects.opportunityScore)).limit(filters?.limit ?? 200);
}

export async function getProspectReminders(ownerId: number) {
  const [overdue, today, upcoming] = await Promise.all([
    listProspects(ownerId, { dueState: "overdue", limit: 100 }),
    listProspects(ownerId, { dueState: "today", limit: 100 }),
    listProspects(ownerId, { dueState: "upcoming", limit: 100 }),
  ]);
  return { overdue, today, upcoming };
}

export async function getProspect(ownerId: number, prospectId: number) {
  const rows = await listProspects(ownerId, { limit: 500 });
  return rows.find(row => row.prospect.id === prospectId);
}

export async function updateRunProspect(ownerId: number, prospectId: number, data: Partial<{ status: "new" | "qualified" | "rejected" | "exported" | "analysis_pending" | "analyzed" | "demo_pending" | "contact_pending" | "contacted" | "converted" | "lost"; notes: string | null; nextActionLabel: string | null; nextActionAt: Date | null; lastContactedAt: Date | null }>) {
  const prospect = await getProspect(ownerId, prospectId);
  if (!prospect) return undefined;
  const db = await getDb();
  if (!db) return undefined;
  await db.update(runProspects).set(data).where(eq(runProspects.id, prospectId));
  return getProspect(ownerId, prospectId);
}

export async function createProspectActivity(data: { ownerId: number; prospectId: number; action: string; note?: string | null; previousStatus?: string | null; nextStatus?: string | null; nextActionLabel?: string | null; nextActionAt?: Date | null }) {
  const db = await getDb();
  if (!db) throw new Error("La base de datos no está disponible.");
  const result = await db.insert(prospectActivities).values(data);
  return (await db.select().from(prospectActivities).where(eq(prospectActivities.id, Number(result[0].insertId))).limit(1))[0]!;
}

export async function listProspectActivities(ownerId: number, prospectId: number) {
  const prospect = await getProspect(ownerId, prospectId);
  if (!prospect) return [];
  const db = await getDb();
  if (!db) return [];
  return db.select().from(prospectActivities).where(and(eq(prospectActivities.ownerId, ownerId), eq(prospectActivities.prospectId, prospectId))).orderBy(desc(prospectActivities.createdAt));
}

export async function getOrCreateHandoffPolicy(ownerId: number) {
  const db = await getDb();
  if (!db) throw new Error("La base de datos no está disponible.");
  const current = (await db.select().from(handoffPolicies).where(eq(handoffPolicies.ownerId, ownerId)).limit(1))[0];
  if (current) return current;
  const result = await db.insert(handoffPolicies).values({ ownerId });
  return (await db.select().from(handoffPolicies).where(eq(handoffPolicies.id, Number(result[0].insertId))).limit(1))[0]!;
}

export async function updateHandoffPolicy(ownerId: number, data: Partial<{ minimumOpportunityScore: number; requireNextAction: number; requireDigitalEvidence: number; destinationLabel: string }>) {
  const current = await getOrCreateHandoffPolicy(ownerId);
  const db = await getDb();
  if (!db) throw new Error("La base de datos no está disponible.");
  await db.update(handoffPolicies).set(data).where(eq(handoffPolicies.id, current.id));
  return getOrCreateHandoffPolicy(ownerId);
}

export async function getOrCreateHandoffIntegration(ownerId: number) {
  const db = await getDb();
  if (!db) throw new Error("La base de datos no está disponible.");
  const current = (await db.select().from(handoffIntegrations).where(eq(handoffIntegrations.ownerId, ownerId)).limit(1))[0];
  if (current) return current;
  const result = await db.insert(handoffIntegrations).values({ ownerId });
  return (await db.select().from(handoffIntegrations).where(eq(handoffIntegrations.id, Number(result[0].insertId))).limit(1))[0]!;
}

export async function updateHandoffIntegration(ownerId: number, data: Partial<{
  displayName: string;
  webhookUrl: string | null;
  isEnabled: number;
  lastDeliveryAt: Date | null;
  lastDeliveryStatus: "not_sent" | "succeeded" | "failed";
  lastDeliveryError: string | null;
}>) {
  const current = await getOrCreateHandoffIntegration(ownerId);
  const db = await getDb();
  if (!db) throw new Error("La base de datos no está disponible.");
  await db.update(handoffIntegrations).set(data).where(eq(handoffIntegrations.id, current.id));
  return getOrCreateHandoffIntegration(ownerId);
}

export async function getProspectHandoff(ownerId: number, prospectId: number) {
  const db = await getDb();
  if (!db) return undefined;
  return (await db.select().from(prospectHandoffs).where(and(eq(prospectHandoffs.ownerId, ownerId), eq(prospectHandoffs.prospectId, prospectId))).limit(1))[0];
}

export async function upsertProspectHandoff(data: { ownerId: number; prospectId: number; destinationLabel: string; eligibilitySnapshot: Record<string, unknown>; note?: string | null }) {
  const existing = await getProspectHandoff(data.ownerId, data.prospectId);
  const db = await getDb();
  if (!db) throw new Error("La base de datos no está disponible.");
  if (existing) {
    await db.update(prospectHandoffs).set({ destinationLabel: data.destinationLabel, eligibilitySnapshot: data.eligibilitySnapshot, note: data.note ?? existing.note }).where(eq(prospectHandoffs.id, existing.id));
    return getProspectHandoff(data.ownerId, data.prospectId);
  }
  const result = await db.insert(prospectHandoffs).values(data);
  return (await db.select().from(prospectHandoffs).where(eq(prospectHandoffs.id, Number(result[0].insertId))).limit(1))[0]!;
}

export async function updateProspectHandoff(ownerId: number, prospectId: number, data: Partial<{ status: "ready_for_review" | "approved" | "package_exported" | "delivered" | "returned"; approvedAt: Date | null; packageExportedAt: Date | null; deliveredAt: Date | null; externalReference: string | null; note: string | null; eligibilitySnapshot: Record<string, unknown> }>) {
  const current = await getProspectHandoff(ownerId, prospectId);
  if (!current) return undefined;
  const db = await getDb();
  if (!db) return undefined;
  await db.update(prospectHandoffs).set(data).where(eq(prospectHandoffs.id, current.id));
  return getProspectHandoff(ownerId, prospectId);
}

export async function listProspectHandoffs(ownerId: number, status?: "ready_for_review" | "approved" | "package_exported" | "delivered" | "returned") {
  const db = await getDb();
  if (!db) return [];
  const predicates = [eq(prospectHandoffs.ownerId, ownerId)];
  if (status) predicates.push(eq(prospectHandoffs.status, status));
  return db.select({ handoff: prospectHandoffs, prospect: runProspects, business: businesses, run: prospectingRuns }).from(prospectHandoffs).innerJoin(runProspects, eq(prospectHandoffs.prospectId, runProspects.id)).innerJoin(businesses, eq(runProspects.businessId, businesses.id)).innerJoin(prospectingRuns, eq(runProspects.runId, prospectingRuns.id)).where(and(...predicates)).orderBy(desc(prospectHandoffs.updatedAt));
}

export async function updateAnalyzedProspect(ownerId: number, prospectId: number, data: {
  status: "analyzed";
  opportunityScore: number;
  businessAttractivenessScore: number;
  digitalOpportunityScore: number;
  websiteOpportunityScore: number;
  leadPotentialScore: number;
  commercialPotentialScore: number;
  urgencyScore: number;
  priority: "p0" | "p1" | "p2" | "p3" | "ignore";
  opportunityTypes: string[];
  scoreReasons: Array<{ label: string; points: number }>;
  analysisSummary: string;
  analysisConfidence: number;
}) {
  const prospect = await getProspect(ownerId, prospectId);
  if (!prospect) return undefined;
  const db = await getDb();
  if (!db) return undefined;
  await db.update(runProspects).set({ ...data, analysisConfidence: String(data.analysisConfidence), lastCheckedAt: new Date() }).where(eq(runProspects.id, prospectId));
  return getProspect(ownerId, prospectId);
}

export async function updateBusinessWebsiteAnalysis(ownerId: number, businessId: number, data: {
  websiteQuality: "excellent" | "good" | "average" | "weak" | "very_weak" | "broken";
  websiteSignals: Record<string, boolean | number | string | null>;
}) {
  const db = await getDb();
  if (!db) return undefined;
  await db.update(businesses).set(data).where(and(eq(businesses.id, businessId), eq(businesses.ownerId, ownerId)));
  return (await db.select().from(businesses).where(and(eq(businesses.id, businessId), eq(businesses.ownerId, ownerId))).limit(1))[0];
}

export async function createWebsiteAnalysis(data: {
  ownerId: number;
  prospectId: number;
  url: string;
  strategy: "mobile" | "desktop";
  status: "completed" | "failed" | "skipped";
  performanceScore?: number | null;
  accessibilityScore?: number | null;
  bestPracticesScore?: number | null;
  seoScore?: number | null;
  signals?: Record<string, boolean | number | string | null> | null;
  summary?: string | null;
  errorMessage?: string | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("La base de datos no está disponible.");
  const result = await db.insert(websiteAnalyses).values(data);
  return (await db.select().from(websiteAnalyses).where(eq(websiteAnalyses.id, Number(result[0].insertId))).limit(1))[0]!;
}

export async function listWebsiteAnalyses(ownerId: number, prospectId: number) {
  const prospect = await getProspect(ownerId, prospectId);
  if (!prospect) return [];
  const db = await getDb();
  if (!db) return [];
  return db.select().from(websiteAnalyses).where(and(eq(websiteAnalyses.ownerId, ownerId), eq(websiteAnalyses.prospectId, prospectId))).orderBy(desc(websiteAnalyses.analyzedAt));
}

export async function recordProspectExport(data: {
  ownerId: number;
  prospectId: number;
  destination: "google_sheets";
  destinationLabel: string;
  externalReference?: string | null;
  status: "succeeded" | "failed";
  errorMessage?: string | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("La base de datos no está disponible.");
  const result = await db.insert(prospectExports).values(data);
  return (await db.select().from(prospectExports).where(eq(prospectExports.id, Number(result[0].insertId))).limit(1))[0]!;
}

export async function listProspectExports(ownerId: number, prospectId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(prospectExports).where(and(eq(prospectExports.ownerId, ownerId), eq(prospectExports.prospectId, prospectId))).orderBy(desc(prospectExports.exportedAt));
}

const DEFAULT_TEMPLATES = [
  {
    name: "Cualificación inicial",
    type: "qualification" as const,
    subject: null,
    body: "Negocio: {{business_name}}\nUbicación: {{location}}\nPuntaje: {{opportunity_score}}\n\nSeñales a revisar:\n{{opportunity_reasons}}\n\nNotas de cualificación:\n",
  },
  {
    name: "Contacto: oportunidad web",
    type: "contact" as const,
    subject: "Una oportunidad para la presencia digital de {{business_name}}",
    body: "Hola, equipo de {{business_name}}:\n\nEstoy revisando negocios de {{location}} y detecté una oportunidad potencial para fortalecer su presencia digital. Si les parece oportuno, puedo compartir una revisión breve y sin compromiso basada en señales públicas de su sitio y perfil local.\n\nSaludos,\n{{sender_name}}",
  },
];

export async function getOrCreateQualificationTemplates(ownerId: number) {
  const db = await getDb();
  if (!db) return [];
  const current = await db.select().from(qualificationTemplates).where(eq(qualificationTemplates.ownerId, ownerId)).orderBy(desc(qualificationTemplates.updatedAt));
  if (current.length) return current;
  await db.insert(qualificationTemplates).values(DEFAULT_TEMPLATES.map((template, index) => ({ ...template, ownerId, isDefault: index === 0 ? 1 : 0 })));
  return db.select().from(qualificationTemplates).where(eq(qualificationTemplates.ownerId, ownerId)).orderBy(desc(qualificationTemplates.updatedAt));
}

export async function createQualificationTemplate(ownerId: number, data: { name: string; type: "qualification" | "contact"; subject?: string | null; body: string; isDefault?: number }) {
  const db = await getDb();
  if (!db) throw new Error("La base de datos no está disponible.");
  const result = await db.insert(qualificationTemplates).values({ ownerId, ...data });
  return (await db.select().from(qualificationTemplates).where(eq(qualificationTemplates.id, Number(result[0].insertId))).limit(1))[0]!;
}

export async function updateQualificationTemplate(ownerId: number, templateId: number, data: Partial<{ name: string; subject: string | null; body: string; isDefault: number }>) {
  const db = await getDb();
  if (!db) return undefined;
  await db.update(qualificationTemplates).set(data).where(and(eq(qualificationTemplates.id, templateId), eq(qualificationTemplates.ownerId, ownerId)));
  return (await db.select().from(qualificationTemplates).where(and(eq(qualificationTemplates.id, templateId), eq(qualificationTemplates.ownerId, ownerId))).limit(1))[0];
}

export async function deleteQualificationTemplate(ownerId: number, templateId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(qualificationTemplates).where(and(eq(qualificationTemplates.id, templateId), eq(qualificationTemplates.ownerId, ownerId)));
}

const DEFAULT_WEB_SCOPE_TEMPLATES = [
  { name: "Servicios profesionales", sector: "Servicios profesionales", overview: "Sitio orientado a credibilidad, explicación clara de servicios y captación de consultas cualificadas.", deliverables: ["Página de servicios", "Formulario de contacto", "Sección de confianza y proceso", "Analítica básica"], successMetrics: ["Consultas cualificadas", "Solicitudes de presupuesto", "Conversión de formularios"] },
  { name: "Restaurantes y cafeterías", sector: "Gastronomía", overview: "Experiencia móvil para mostrar propuesta gastronómica, ubicación, horarios y canales de reserva o pedido.", deliverables: ["Menú editable", "Horario y mapa", "Llamadas a reserva o pedido", "Galería de marca"], successMetrics: ["Clics en reserva", "Clics en llamada", "Visitas a menú"] },
  { name: "Salud y bienestar", sector: "Salud y bienestar", overview: "Presencia informativa y accesible para presentar servicios, especialistas y solicitud de cita.", deliverables: ["Servicios y especialidades", "Solicitud de cita", "Preguntas frecuentes", "Avisos de privacidad"], successMetrics: ["Solicitudes de cita", "Llamadas desde móvil", "Lectura de servicios"] },
  { name: "Comercio local", sector: "Comercio", overview: "Vitrina digital enfocada en catálogo, ubicación y rutas claras de compra o contacto.", deliverables: ["Catálogo destacado", "Ubicación y horarios", "Canal de consulta", "Promociones editables"], successMetrics: ["Consultas sobre productos", "Clics a contacto", "Visitas a catálogo"] },
];

export async function getOrCreateGuideProgress(ownerId: number) {
  const db = await getDb();
  if (!db) return { ownerId, completedSteps: [] as number[] };
  const current = await db.select().from(userGuideProgress).where(eq(userGuideProgress.ownerId, ownerId)).limit(1);
  if (current[0]) return current[0];
  await db.insert(userGuideProgress).values({ ownerId, completedSteps: [] });
  return (await db.select().from(userGuideProgress).where(eq(userGuideProgress.ownerId, ownerId)).limit(1))[0]!;
}

export async function updateGuideProgress(ownerId: number, completedSteps: number[]) {
  const db = await getDb();
  if (!db) throw new Error("La base de datos no está disponible.");
  const safeSteps = Array.from(new Set(completedSteps.filter(step => Number.isInteger(step) && step >= 0 && step < 5))).sort((a, b) => a - b);
  const current = await db.select({ id: userGuideProgress.id }).from(userGuideProgress).where(eq(userGuideProgress.ownerId, ownerId)).limit(1);
  if (current[0]) await db.update(userGuideProgress).set({ completedSteps: safeSteps }).where(eq(userGuideProgress.ownerId, ownerId));
  else await db.insert(userGuideProgress).values({ ownerId, completedSteps: safeSteps });
  return getOrCreateGuideProgress(ownerId);
}

export async function getOrCreateWebScopeTemplates(ownerId: number) {
  const db = await getDb();
  if (!db) return [];
  const current = await db.select().from(webScopeTemplates).where(eq(webScopeTemplates.ownerId, ownerId)).orderBy(desc(webScopeTemplates.updatedAt));
  if (current.length) return current;
  await db.insert(webScopeTemplates).values(DEFAULT_WEB_SCOPE_TEMPLATES.map((template, index) => ({ ...template, ownerId, isDefault: index === 0 ? 1 : 0 })));
  return db.select().from(webScopeTemplates).where(eq(webScopeTemplates.ownerId, ownerId)).orderBy(desc(webScopeTemplates.updatedAt));
}

export async function getWebScopeTemplate(ownerId: number, templateId: number) {
  const db = await getDb();
  if (!db) return undefined;
  return (await db.select().from(webScopeTemplates).where(and(eq(webScopeTemplates.ownerId, ownerId), eq(webScopeTemplates.id, templateId))).limit(1))[0];
}

export async function createWebScopeTemplate(ownerId: number, data: { name: string; sector: string; overview: string; deliverables: string[]; successMetrics: string[]; isDefault?: number }) {
  const db = await getDb();
  if (!db) throw new Error("La base de datos no está disponible.");
  const result = await db.insert(webScopeTemplates).values({ ownerId, ...data });
  return (await db.select().from(webScopeTemplates).where(eq(webScopeTemplates.id, Number(result[0].insertId))).limit(1))[0]!;
}

export async function updateWebScopeTemplate(ownerId: number, templateId: number, data: Partial<{ name: string; sector: string; overview: string; deliverables: string[]; successMetrics: string[]; isDefault: number }>) {
  const db = await getDb();
  if (!db) return undefined;
  await db.update(webScopeTemplates).set(data).where(and(eq(webScopeTemplates.id, templateId), eq(webScopeTemplates.ownerId, ownerId)));
  return getWebScopeTemplate(ownerId, templateId);
}

export async function deleteWebScopeTemplate(ownerId: number, templateId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(webScopeTemplates).where(and(eq(webScopeTemplates.id, templateId), eq(webScopeTemplates.ownerId, ownerId)));
}

export async function getScannerDashboard(ownerId: number) {
  const db = await getDb();
  if (!db) return { totalRuns: 0, found: 0, unique: 0, withWebsite: 0, withoutWebsite: 0, p0: 0, p1: 0, p2: 0, averageScore: 0 };
  const runs = await db.select().from(prospectingRuns).where(eq(prospectingRuns.ownerId, ownerId));
  const prospects = await listProspects(ownerId, { limit: 5000 });
  const scores = prospects.map(item => item.prospect.opportunityScore);
  return {
    totalRuns: runs.length,
    found: runs.reduce((total, run) => total + run.foundCount, 0),
    unique: runs.reduce((total, run) => total + run.uniqueCount, 0),
    withWebsite: prospects.filter(item => item.business.websiteStatus === "website_found").length,
    withoutWebsite: prospects.filter(item => item.business.websiteStatus === "no_website").length,
    p0: prospects.filter(item => item.prospect.priority === "p0").length,
    p1: prospects.filter(item => item.prospect.priority === "p1").length,
    p2: prospects.filter(item => item.prospect.priority === "p2").length,
    averageScore: scores.length ? Math.round(scores.reduce((total, score) => total + score, 0) / scores.length) : 0,
  };
}

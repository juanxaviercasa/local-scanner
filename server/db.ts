import { and, desc, eq, inArray, like, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  activities,
  InsertUser,
  projectFiles,
  projects,
  projectMembers,
  tasks,
  users,
} from "../drizzle/schema";
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

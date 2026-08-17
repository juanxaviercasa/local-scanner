import {
  bigint,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

/**
 * Identidad gestionada por Manus OAuth. Los campos de perfil permiten que cada
 * persona adapte su experiencia sin almacenar secretos ni credenciales externas.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  avatarUrl: varchar("avatarUrl", { length: 1024 }),
  themePreference: mysqlEnum("themePreference", ["system", "light", "dark"])
    .default("system")
    .notNull(),
  timezone: varchar("timezone", { length: 64 }).default("UTC").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

/** Proyecto principal perteneciente a un usuario. */
export const projects = mysqlTable(
  "projects",
  {
    id: int("id").autoincrement().primaryKey(),
    ownerId: int("ownerId").notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    description: text("description"),
    status: mysqlEnum("status", ["active", "paused", "completed"])
      .default("active")
      .notNull(),
    dueDate: timestamp("dueDate"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("projects_owner_idx").on(table.ownerId), index("projects_status_idx").on(table.status)]
);

/** Miembros con acceso explícito a un proyecto; habilita colaboración futura. */
export const projectMembers = mysqlTable(
  "projectMembers",
  {
    id: int("id").autoincrement().primaryKey(),
    projectId: int("projectId").notNull(),
    userId: int("userId").notNull(),
    role: mysqlEnum("role", ["owner", "member"]).default("member").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    index("project_members_project_idx").on(table.projectId),
    index("project_members_user_idx").on(table.userId),
  ]
);

/** Tarea vinculada a un proyecto, con prioridad, estado y responsable opcional. */
export const tasks = mysqlTable(
  "tasks",
  {
    id: int("id").autoincrement().primaryKey(),
    projectId: int("projectId").notNull(),
    creatorId: int("creatorId").notNull(),
    assigneeId: int("assigneeId"),
    title: varchar("title", { length: 200 }).notNull(),
    description: text("description"),
    priority: mysqlEnum("priority", ["low", "medium", "high", "urgent"])
      .default("medium")
      .notNull(),
    status: mysqlEnum("status", ["todo", "in_progress", "done"])
      .default("todo")
      .notNull(),
    dueDate: timestamp("dueDate"),
    completedAt: timestamp("completedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    index("tasks_project_idx").on(table.projectId),
    index("tasks_assignee_idx").on(table.assigneeId),
    index("tasks_status_idx").on(table.status),
  ]
);

/** Metadatos de archivos. Los bytes viven exclusivamente en almacenamiento S3. */
export const projectFiles = mysqlTable(
  "projectFiles",
  {
    id: int("id").autoincrement().primaryKey(),
    projectId: int("projectId").notNull(),
    uploadedById: int("uploadedById").notNull(),
    originalName: varchar("originalName", { length: 255 }).notNull(),
    storageKey: varchar("storageKey", { length: 512 }).notNull(),
    storageUrl: varchar("storageUrl", { length: 1024 }).notNull(),
    mimeType: varchar("mimeType", { length: 127 }).notNull(),
    sizeBytes: bigint("sizeBytes", { mode: "number" }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("project_files_project_idx").on(table.projectId)]
);

/** Registro inmutable para representar acciones relevantes de cada espacio de trabajo. */
export const activities = mysqlTable(
  "activities",
  {
    id: int("id").autoincrement().primaryKey(),
    actorId: int("actorId").notNull(),
    projectId: int("projectId"),
    entityType: mysqlEnum("entityType", ["project", "task", "file", "profile", "admin"])
      .notNull(),
    entityId: int("entityId"),
    action: varchar("action", { length: 80 }).notNull(),
    summary: varchar("summary", { length: 300 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    index("activities_actor_idx").on(table.actorId),
    index("activities_project_idx").on(table.projectId),
    index("activities_created_idx").on(table.createdAt),
  ]
);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Project = typeof projects.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type ProjectFile = typeof projectFiles.$inferSelect;
export type Activity = typeof activities.$inferSelect;

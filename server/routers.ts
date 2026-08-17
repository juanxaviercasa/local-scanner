import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import {
  addProjectMember,
  createActivity,
  createProject,
  createProjectFile,
  createTask,
  deleteProject,
  deleteProjectFile,
  deleteTask,
  getDashboardMetrics,
  getProjectFileById,
  getProjectForUser,
  getTaskById,
  getUserById,
  isProjectMember,
  listActivitiesForUser,
  listAssignableUsers,
  listFilesForProject,
  listProjectMembers,
  listProjectsForUser,
  listTasksForProject,
  listUsers,
  updateProject,
  updateTask,
  updateUserProfile,
  updateUserRole,
} from "./db";
import { storagePut } from "./storage";

const projectStatusSchema = z.enum(["active", "paused", "completed"]);
const taskStatusSchema = z.enum(["todo", "in_progress", "done"]);
const taskPrioritySchema = z.enum(["low", "medium", "high", "urgent"]);

const optionalDate = z.date().nullable().optional();

function forbidden(message = "No tienes permisos para acceder a este recurso."): never {
  throw new TRPCError({ code: "FORBIDDEN", message });
}

async function requireProjectAccess(projectId: number, userId: number) {
  const project = await getProjectForUser(projectId, userId);
  if (!project) forbidden();
  return project;
}

async function requireProjectOwner(projectId: number, userId: number) {
  const project = await requireProjectAccess(projectId, userId);
  if (project.ownerId !== userId) forbidden("Solo la persona propietaria puede modificar este proyecto.");
  return project;
}

async function requireAssignableMember(projectId: number, assigneeId?: number | null) {
  if (assigneeId === undefined || assigneeId === null) return;
  if (!(await isProjectMember(projectId, assigneeId))) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "La persona seleccionada no pertenece a este proyecto.",
    });
  }
}

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 180) || "archivo";
}

function maxUploadBytes() {
  const configuredMb = Number(process.env.NEXO_MAX_UPLOAD_MB ?? 10);
  const safeMb = Number.isFinite(configuredMb) && configuredMb > 0 ? Math.min(configuredMb, 20) : 10;
  return Math.floor(safeMb * 1024 * 1024);
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  dashboard: router({
    metrics: protectedProcedure.query(({ ctx }) => getDashboardMetrics(ctx.user.id)),
  }),

  projects: router({
    list: protectedProcedure.query(({ ctx }) => listProjectsForUser(ctx.user.id)),
    get: protectedProcedure.input(z.object({ projectId: z.number().int().positive() })).query(({ ctx, input }) =>
      requireProjectAccess(input.projectId, ctx.user.id)
    ),
    members: protectedProcedure
      .input(z.object({ projectId: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        await requireProjectAccess(input.projectId, ctx.user.id);
        return listProjectMembers(input.projectId);
      }),
    availableUsers: protectedProcedure
      .input(z.object({ projectId: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        await requireProjectOwner(input.projectId, ctx.user.id);
        return listAssignableUsers();
      }),
    addMember: protectedProcedure
      .input(z.object({ projectId: z.number().int().positive(), userId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        await requireProjectOwner(input.projectId, ctx.user.id);
        const user = await getUserById(input.userId);
        if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "No se encontró la persona usuaria." });
        const added = await addProjectMember(input.projectId, input.userId);
        if (!added) throw new TRPCError({ code: "CONFLICT", message: "Esta persona ya pertenece al proyecto." });
        await createActivity({
          actorId: ctx.user.id,
          projectId: input.projectId,
          entityType: "project",
          entityId: input.projectId,
          action: "member_added",
          summary: `Incorporó a ${user.name ?? user.email ?? "una persona"} al proyecto.`,
        });
        return { success: true } as const;
      }),
    create: protectedProcedure
      .input(
        z.object({
          name: z.string().trim().min(2, "Escribe un nombre de al menos 2 caracteres.").max(160),
          description: z.string().trim().max(5000).nullable().optional(),
          status: projectStatusSchema.optional(),
          dueDate: optionalDate,
        })
      )
      .mutation(async ({ ctx, input }) => {
        const project = await createProject({ ...input, ownerId: ctx.user.id });
        await createActivity({
          actorId: ctx.user.id,
          projectId: project.id,
          entityType: "project",
          entityId: project.id,
          action: "created",
          summary: `Creó el proyecto «${project.name}».`,
        });
        return project;
      }),
    update: protectedProcedure
      .input(
        z.object({
          projectId: z.number().int().positive(),
          name: z.string().trim().min(2).max(160).optional(),
          description: z.string().trim().max(5000).nullable().optional(),
          status: projectStatusSchema.optional(),
          dueDate: optionalDate,
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { projectId, ...changes } = input;
        const previous = await requireProjectOwner(projectId, ctx.user.id);
        const project = await updateProject(projectId, changes);
        await createActivity({
          actorId: ctx.user.id,
          projectId,
          entityType: "project",
          entityId: projectId,
          action: "updated",
          summary: `Actualizó el proyecto «${previous.name}».`,
        });
        return project;
      }),
    remove: protectedProcedure
      .input(z.object({ projectId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        await requireProjectOwner(input.projectId, ctx.user.id);
        await deleteProject(input.projectId);
        return { success: true } as const;
      }),
  }),

  tasks: router({
    list: protectedProcedure
      .input(
        z.object({
          projectId: z.number().int().positive(),
          status: taskStatusSchema.optional(),
          priority: taskPrioritySchema.optional(),
          query: z.string().trim().max(160).optional(),
        })
      )
      .query(async ({ ctx, input }) => {
        await requireProjectAccess(input.projectId, ctx.user.id);
        return listTasksForProject(input.projectId, input);
      }),
    create: protectedProcedure
      .input(
        z.object({
          projectId: z.number().int().positive(),
          title: z.string().trim().min(2).max(200),
          description: z.string().trim().max(5000).nullable().optional(),
          assigneeId: z.number().int().positive().nullable().optional(),
          priority: taskPrioritySchema.optional(),
          status: taskStatusSchema.optional(),
          dueDate: optionalDate,
        })
      )
      .mutation(async ({ ctx, input }) => {
        await requireProjectAccess(input.projectId, ctx.user.id);
        const assigneeId = input.assigneeId === undefined ? ctx.user.id : input.assigneeId;
        await requireAssignableMember(input.projectId, assigneeId);
        const task = await createTask({ ...input, creatorId: ctx.user.id, assigneeId });
        await createActivity({
          actorId: ctx.user.id,
          projectId: input.projectId,
          entityType: "task",
          entityId: task.id,
          action: "created",
          summary: `Creó la tarea «${task.title}».`,
        });
        return task;
      }),
    update: protectedProcedure
      .input(
        z.object({
          taskId: z.number().int().positive(),
          title: z.string().trim().min(2).max(200).optional(),
          description: z.string().trim().max(5000).nullable().optional(),
          assigneeId: z.number().int().positive().nullable().optional(),
          priority: taskPrioritySchema.optional(),
          status: taskStatusSchema.optional(),
          dueDate: optionalDate,
        })
      )
      .mutation(async ({ ctx, input }) => {
        const task = await getTaskById(input.taskId);
        if (!task) throw new TRPCError({ code: "NOT_FOUND", message: "No se encontró la tarea." });
        await requireProjectAccess(task.projectId, ctx.user.id);
        const { taskId, status, ...changes } = input;
        await requireAssignableMember(task.projectId, changes.assigneeId);
        const completedAt = status === "done" ? new Date() : status ? null : undefined;
        const updated = await updateTask(taskId, { ...changes, status, completedAt });
        if (status === "done" && task.status !== "done") {
          await createActivity({
            actorId: ctx.user.id,
            projectId: task.projectId,
            entityType: "task",
            entityId: task.id,
            action: "completed",
            summary: `Completó la tarea «${task.title}».`,
          });
        } else {
          await createActivity({
            actorId: ctx.user.id,
            projectId: task.projectId,
            entityType: "task",
            entityId: task.id,
            action: "updated",
            summary: `Actualizó la tarea «${task.title}».`,
          });
        }
        return updated;
      }),
    remove: protectedProcedure
      .input(z.object({ taskId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const task = await getTaskById(input.taskId);
        if (!task) throw new TRPCError({ code: "NOT_FOUND", message: "No se encontró la tarea." });
        await requireProjectAccess(task.projectId, ctx.user.id);
        await deleteTask(task.id);
        await createActivity({
          actorId: ctx.user.id,
          projectId: task.projectId,
          entityType: "task",
          entityId: task.id,
          action: "deleted",
          summary: `Eliminó la tarea «${task.title}».`,
        });
        return { success: true } as const;
      }),
  }),

  files: router({
    list: protectedProcedure
      .input(z.object({ projectId: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        await requireProjectAccess(input.projectId, ctx.user.id);
        return listFilesForProject(input.projectId);
      }),
    upload: protectedProcedure
      .input(
        z.object({
          projectId: z.number().int().positive(),
          originalName: z.string().trim().min(1).max(255),
          mimeType: z.string().trim().min(1).max(127),
          contentBase64: z.string().min(1),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await requireProjectAccess(input.projectId, ctx.user.id);
        const encoded = input.contentBase64.replace(/^data:[^;]+;base64,/, "");
        const data = Buffer.from(encoded, "base64");
        if (!data.length || data.length > maxUploadBytes()) {
          throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "El archivo supera el tamaño permitido." });
        }
        const safeName = sanitizeFileName(input.originalName);
        const { key, url } = await storagePut(
          `nexo-ops/projects/${input.projectId}/${ctx.user.id}/${safeName}`,
          data,
          input.mimeType
        );
        const file = await createProjectFile({
          projectId: input.projectId,
          uploadedById: ctx.user.id,
          originalName: input.originalName,
          storageKey: key,
          storageUrl: url,
          mimeType: input.mimeType,
          sizeBytes: data.length,
        });
        await createActivity({
          actorId: ctx.user.id,
          projectId: input.projectId,
          entityType: "file",
          entityId: file.id,
          action: "uploaded",
          summary: `Subió el archivo «${file.originalName}».`,
        });
        return file;
      }),
    download: protectedProcedure
      .input(z.object({ fileId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const file = await getProjectFileById(input.fileId);
        if (!file) throw new TRPCError({ code: "NOT_FOUND", message: "No se encontró el archivo." });
        await requireProjectAccess(file.projectId, ctx.user.id);
        return { name: file.originalName, url: file.storageUrl };
      }),
    remove: protectedProcedure
      .input(z.object({ fileId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const file = await getProjectFileById(input.fileId);
        if (!file) throw new TRPCError({ code: "NOT_FOUND", message: "No se encontró el archivo." });
        const project = await requireProjectAccess(file.projectId, ctx.user.id);
        if (project.ownerId !== ctx.user.id && file.uploadedById !== ctx.user.id) forbidden("Solo quien subió el archivo o la persona propietaria puede eliminarlo.");
        await deleteProjectFile(file.id);
        await createActivity({
          actorId: ctx.user.id,
          projectId: file.projectId,
          entityType: "file",
          entityId: file.id,
          action: "removed",
          summary: `Eliminó el archivo «${file.originalName}».`,
        });
        return { success: true } as const;
      }),
  }),

  activity: router({
    list: protectedProcedure
      .input(z.object({ limit: z.number().int().min(1).max(100).optional() }).optional())
      .query(({ ctx, input }) => listActivitiesForUser(ctx.user.id, input?.limit ?? 40)),
  }),

  profile: router({
    update: protectedProcedure
      .input(
        z.object({
          name: z.string().trim().min(2).max(120).nullable().optional(),
          avatarUrl: z.string().url().max(1024).nullable().optional(),
          themePreference: z.enum(["system", "light", "dark"]).optional(),
          timezone: z.string().trim().min(1).max(64).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const user = await updateUserProfile(ctx.user.id, input);
        await createActivity({
          actorId: ctx.user.id,
          entityType: "profile",
          entityId: ctx.user.id,
          action: "updated",
          summary: "Actualizó sus preferencias de perfil.",
        });
        return user;
      }),
  }),

  admin: router({
    users: adminProcedure.query(() => listUsers()),
    updateRole: adminProcedure
      .input(z.object({ userId: z.number().int().positive(), role: z.enum(["admin", "user"]) }))
      .mutation(async ({ ctx, input }) => {
        if (input.userId === ctx.user.id && input.role !== "admin") {
          forbidden("No puedes revocar tu propio acceso de administrador.");
        }
        const user = await updateUserRole(input.userId, input.role);
        if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "No se encontró la persona usuaria." });
        await createActivity({
          actorId: ctx.user.id,
          entityType: "admin",
          entityId: user.id,
          action: "role_updated",
          summary: `Actualizó el rol de ${user.name ?? user.email ?? "una persona usuaria"}.`,
        });
        return user;
      }),
  }),

  integrations: router({
    status: protectedProcedure.query(() => ({
      maxUploadMb: Math.floor(maxUploadBytes() / 1024 / 1024),
      configured: {
        analytics: Boolean(process.env.NEXO_ANALYTICS_URL),
        notifications: Boolean(process.env.NEXO_NOTIFICATIONS_WEBHOOK_URL),
        externalApi: Boolean(process.env.NEXO_EXTERNAL_API_BASE_URL && process.env.NEXO_EXTERNAL_API_KEY),
      },
      message: "Las integraciones externas se activan exclusivamente mediante variables de entorno documentadas.",
    })),
  }),
});

export type AppRouter = typeof appRouter;

CREATE TABLE `activities` (
	`id` int AUTO_INCREMENT NOT NULL,
	`actorId` int NOT NULL,
	`projectId` int,
	`entityType` enum('project','task','file','profile','admin') NOT NULL,
	`entityId` int,
	`action` varchar(80) NOT NULL,
	`summary` varchar(300) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `activities_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `projectFiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`uploadedById` int NOT NULL,
	`originalName` varchar(255) NOT NULL,
	`storageKey` varchar(512) NOT NULL,
	`storageUrl` varchar(1024) NOT NULL,
	`mimeType` varchar(127) NOT NULL,
	`sizeBytes` bigint NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `projectFiles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `projectMembers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`userId` int NOT NULL,
	`role` enum('owner','member') NOT NULL DEFAULT 'member',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `projectMembers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`name` varchar(160) NOT NULL,
	`description` text,
	`status` enum('active','paused','completed') NOT NULL DEFAULT 'active',
	`dueDate` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `projects_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`creatorId` int NOT NULL,
	`assigneeId` int,
	`title` varchar(200) NOT NULL,
	`description` text,
	`priority` enum('low','medium','high','urgent') NOT NULL DEFAULT 'medium',
	`status` enum('todo','in_progress','done') NOT NULL DEFAULT 'todo',
	`dueDate` timestamp,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tasks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `avatarUrl` varchar(1024);--> statement-breakpoint
ALTER TABLE `users` ADD `themePreference` enum('system','light','dark') DEFAULT 'system' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `timezone` varchar(64) DEFAULT 'UTC' NOT NULL;--> statement-breakpoint
CREATE INDEX `activities_actor_idx` ON `activities` (`actorId`);--> statement-breakpoint
CREATE INDEX `activities_project_idx` ON `activities` (`projectId`);--> statement-breakpoint
CREATE INDEX `activities_created_idx` ON `activities` (`createdAt`);--> statement-breakpoint
CREATE INDEX `project_files_project_idx` ON `projectFiles` (`projectId`);--> statement-breakpoint
CREATE INDEX `project_members_project_idx` ON `projectMembers` (`projectId`);--> statement-breakpoint
CREATE INDEX `project_members_user_idx` ON `projectMembers` (`userId`);--> statement-breakpoint
CREATE INDEX `projects_owner_idx` ON `projects` (`ownerId`);--> statement-breakpoint
CREATE INDEX `projects_status_idx` ON `projects` (`status`);--> statement-breakpoint
CREATE INDEX `tasks_project_idx` ON `tasks` (`projectId`);--> statement-breakpoint
CREATE INDEX `tasks_assignee_idx` ON `tasks` (`assigneeId`);--> statement-breakpoint
CREATE INDEX `tasks_status_idx` ON `tasks` (`status`);
CREATE TABLE `userGuideProgress` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`completedSteps` json NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `userGuideProgress_id` PRIMARY KEY(`id`),
	CONSTRAINT `userGuideProgress_ownerId_unique` UNIQUE(`ownerId`)
);
--> statement-breakpoint
CREATE TABLE `webScopeTemplates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`name` varchar(140) NOT NULL,
	`sector` varchar(100) NOT NULL,
	`overview` text NOT NULL,
	`deliverables` json NOT NULL,
	`successMetrics` json NOT NULL,
	`isDefault` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `webScopeTemplates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `web_scope_templates_owner_sector_idx` ON `webScopeTemplates` (`ownerId`,`sector`);
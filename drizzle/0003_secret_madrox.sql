CREATE TABLE `prospectExports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`prospectId` int NOT NULL,
	`destination` enum('google_sheets') NOT NULL,
	`destinationLabel` varchar(160) NOT NULL,
	`externalReference` varchar(512),
	`status` enum('succeeded','failed') NOT NULL,
	`errorMessage` varchar(1000),
	`exportedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `prospectExports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `qualificationTemplates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`name` varchar(120) NOT NULL,
	`type` enum('qualification','contact') NOT NULL,
	`subject` varchar(180),
	`body` text NOT NULL,
	`isDefault` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `qualificationTemplates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `websiteAnalyses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`prospectId` int NOT NULL,
	`provider` enum('pagespeed_insights') NOT NULL DEFAULT 'pagespeed_insights',
	`url` varchar(2048) NOT NULL,
	`strategy` enum('mobile','desktop') NOT NULL DEFAULT 'mobile',
	`status` enum('completed','failed','skipped') NOT NULL,
	`performanceScore` int,
	`accessibilityScore` int,
	`bestPracticesScore` int,
	`seoScore` int,
	`signals` json,
	`summary` text,
	`errorMessage` varchar(1000),
	`analyzedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `websiteAnalyses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `prospect_exports_owner_idx` ON `prospectExports` (`ownerId`,`exportedAt`);--> statement-breakpoint
CREATE INDEX `prospect_exports_prospect_idx` ON `prospectExports` (`prospectId`);--> statement-breakpoint
CREATE INDEX `qualification_templates_owner_type_idx` ON `qualificationTemplates` (`ownerId`,`type`);--> statement-breakpoint
CREATE INDEX `website_analyses_prospect_idx` ON `websiteAnalyses` (`prospectId`,`analyzedAt`);
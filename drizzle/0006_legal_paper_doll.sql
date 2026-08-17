CREATE TABLE `handoffPolicies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`minimumOpportunityScore` int NOT NULL DEFAULT 70,
	`requireNextAction` int NOT NULL DEFAULT 1,
	`requireDigitalEvidence` int NOT NULL DEFAULT 1,
	`destinationLabel` varchar(160) NOT NULL DEFAULT 'SaaS de auditoría web',
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `handoffPolicies_id` PRIMARY KEY(`id`),
	CONSTRAINT `handoffPolicies_ownerId_unique` UNIQUE(`ownerId`)
);
--> statement-breakpoint
CREATE TABLE `prospectHandoffs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`prospectId` int NOT NULL,
	`status` enum('ready_for_review','approved','package_exported','delivered','returned') NOT NULL DEFAULT 'ready_for_review',
	`destinationLabel` varchar(160) NOT NULL,
	`eligibilitySnapshot` json NOT NULL,
	`approvedAt` timestamp,
	`packageExportedAt` timestamp,
	`deliveredAt` timestamp,
	`externalReference` varchar(512),
	`note` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `prospectHandoffs_id` PRIMARY KEY(`id`),
	CONSTRAINT `prospectHandoffs_prospectId_unique` UNIQUE(`prospectId`)
);
--> statement-breakpoint
CREATE INDEX `prospect_handoffs_owner_status_idx` ON `prospectHandoffs` (`ownerId`,`status`);--> statement-breakpoint
CREATE INDEX `prospect_handoffs_prospect_idx` ON `prospectHandoffs` (`prospectId`);
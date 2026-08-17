CREATE TABLE `prospectActivities` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`prospectId` int NOT NULL,
	`action` varchar(80) NOT NULL,
	`note` text,
	`previousStatus` varchar(40),
	`nextStatus` varchar(40),
	`nextActionLabel` varchar(240),
	`nextActionAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `prospectActivities_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `runProspects` ADD `nextActionLabel` varchar(240);--> statement-breakpoint
ALTER TABLE `runProspects` ADD `nextActionAt` timestamp;--> statement-breakpoint
ALTER TABLE `runProspects` ADD `lastContactedAt` timestamp;--> statement-breakpoint
CREATE INDEX `prospect_activities_prospect_created_idx` ON `prospectActivities` (`prospectId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `prospect_activities_owner_idx` ON `prospectActivities` (`ownerId`,`createdAt`);
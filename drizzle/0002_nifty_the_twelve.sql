CREATE TABLE `budgetSettings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`dailyRequestBudget` int NOT NULL DEFAULT 250,
	`monthlyRequestBudget` int NOT NULL DEFAULT 5000,
	`maxCostPerRunCents` int NOT NULL DEFAULT 1000,
	`maxBusinessesPerRun` int NOT NULL DEFAULT 50,
	`maxAiCallsPerRun` int NOT NULL DEFAULT 0,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `budgetSettings_id` PRIMARY KEY(`id`),
	CONSTRAINT `budgetSettings_ownerId_unique` UNIQUE(`ownerId`)
);
--> statement-breakpoint
CREATE TABLE `businesses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`source` varchar(64) NOT NULL,
	`externalId` varchar(255) NOT NULL,
	`deduplicationKey` varchar(512) NOT NULL,
	`name` varchar(255) NOT NULL,
	`category` varchar(120),
	`categories` json,
	`address` varchar(500),
	`city` varchar(120),
	`region` varchar(120),
	`country` varchar(80),
	`postalCode` varchar(32),
	`latitude` decimal(10,7),
	`longitude` decimal(10,7),
	`phone` varchar(64),
	`website` varchar(1024),
	`domain` varchar(255),
	`googleMapsUrl` varchar(2048),
	`rating` decimal(2,1),
	`reviewCount` int,
	`businessStatus` varchar(64),
	`websiteStatus` enum('no_website','website_found','website_unreachable','website_unknown') NOT NULL DEFAULT 'website_unknown',
	`websiteQuality` enum('excellent','good','average','weak','very_weak','broken','not_analyzed'),
	`websiteSignals` json,
	`socialProfiles` json,
	`bookingUrl` varchar(2048),
	`whatsappUrl` varchar(2048),
	`dataQualityScore` int NOT NULL DEFAULT 0,
	`sourceTimestamp` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `businesses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `categoryProfiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`category` varchar(120) NOT NULL,
	`commercialPotential` enum('low','medium','high','very_high') NOT NULL DEFAULT 'medium',
	`defaultPriority` enum('p0','p1','p2','p3','ignore') NOT NULL DEFAULT 'p2',
	`recommendedOpportunityTypes` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `categoryProfiles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `prospectingRuns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`publicId` varchar(32) NOT NULL,
	`status` enum('queued','running','paused','completed','partial','failed','cancelled') NOT NULL DEFAULT 'queued',
	`provider` enum('google_maps') NOT NULL DEFAULT 'google_maps',
	`query` varchar(300) NOT NULL,
	`country` varchar(80) NOT NULL,
	`region` varchar(120),
	`city` varchar(120) NOT NULL,
	`district` varchar(120),
	`referenceAddress` varchar(300),
	`latitude` decimal(10,7),
	`longitude` decimal(10,7),
	`radiusMeters` int NOT NULL,
	`primaryCategory` varchar(120) NOT NULL,
	`keywords` json,
	`excludedKeywords` json,
	`websiteMode` enum('no_website','with_website','both') NOT NULL DEFAULT 'both',
	`maxResults` int NOT NULL,
	`minRating` decimal(2,1),
	`minReviewCount` int NOT NULL DEFAULT 0,
	`minOpportunityScore` int NOT NULL DEFAULT 0,
	`scoringSnapshot` json NOT NULL,
	`estimatedOperations` int NOT NULL DEFAULT 0,
	`estimatedCostCents` int NOT NULL DEFAULT 0,
	`foundCount` int NOT NULL DEFAULT 0,
	`uniqueCount` int NOT NULL DEFAULT 0,
	`qualifiedCount` int NOT NULL DEFAULT 0,
	`rejectedCount` int NOT NULL DEFAULT 0,
	`errorCount` int NOT NULL DEFAULT 0,
	`startedAt` timestamp,
	`finishedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `prospectingRuns_id` PRIMARY KEY(`id`),
	CONSTRAINT `prospectingRuns_publicId_unique` UNIQUE(`publicId`)
);
--> statement-breakpoint
CREATE TABLE `rawSearchResults` (
	`id` int AUTO_INCREMENT NOT NULL,
	`runId` int NOT NULL,
	`provider` varchar(64) NOT NULL,
	`providerRecordId` varchar(255) NOT NULL,
	`query` varchar(300) NOT NULL,
	`payload` json NOT NULL,
	`receivedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `rawSearchResults_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `runEvents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`runId` int NOT NULL,
	`stage` enum('plan','search','details','normalize','deduplicate','score','export','budget') NOT NULL,
	`level` enum('info','warning','error') NOT NULL DEFAULT 'info',
	`message` varchar(500) NOT NULL,
	`errorCode` varchar(80),
	`retryCount` int NOT NULL DEFAULT 0,
	`recoverable` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `runEvents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `runProspects` (
	`id` int AUTO_INCREMENT NOT NULL,
	`runId` int NOT NULL,
	`businessId` int NOT NULL,
	`status` enum('new','qualified','rejected','exported','analysis_pending','analyzed','demo_pending','contact_pending','contacted','converted','lost') NOT NULL DEFAULT 'new',
	`duplicateConfidence` enum('exact','high','medium','low') NOT NULL DEFAULT 'exact',
	`opportunityScore` int NOT NULL DEFAULT 0,
	`businessAttractivenessScore` int NOT NULL DEFAULT 0,
	`digitalOpportunityScore` int NOT NULL DEFAULT 0,
	`websiteOpportunityScore` int NOT NULL DEFAULT 0,
	`leadPotentialScore` int NOT NULL DEFAULT 0,
	`commercialPotentialScore` int NOT NULL DEFAULT 0,
	`urgencyScore` int NOT NULL DEFAULT 0,
	`priority` enum('p0','p1','p2','p3','ignore') NOT NULL DEFAULT 'ignore',
	`opportunityTypes` json,
	`scoreReasons` json NOT NULL,
	`analysisSummary` text,
	`analysisConfidence` decimal(3,2),
	`notes` text,
	`lastCheckedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `runProspects_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `scoringProfiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`name` varchar(120) NOT NULL,
	`isDefault` int NOT NULL DEFAULT 0,
	`weights` json NOT NULL,
	`thresholds` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `scoringProfiles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `searchProfiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`name` varchar(120) NOT NULL,
	`country` varchar(80) NOT NULL,
	`region` varchar(120),
	`city` varchar(120) NOT NULL,
	`district` varchar(120),
	`referenceAddress` varchar(300),
	`primaryCategory` varchar(120) NOT NULL,
	`additionalCategories` json,
	`keywords` json,
	`excludedKeywords` json,
	`radiusMeters` int NOT NULL DEFAULT 5000,
	`maxResults` int NOT NULL DEFAULT 20,
	`minRating` decimal(2,1),
	`minReviewCount` int NOT NULL DEFAULT 0,
	`minOpportunityScore` int NOT NULL DEFAULT 0,
	`websiteMode` enum('no_website','with_website','both') NOT NULL DEFAULT 'both',
	`provider` enum('google_maps') NOT NULL DEFAULT 'google_maps',
	`scoringProfileId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `searchProfiles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `usageRecords` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`runId` int,
	`provider` varchar(64) NOT NULL,
	`operation` varchar(80) NOT NULL,
	`requestCount` int NOT NULL DEFAULT 0,
	`estimatedCostCents` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `usageRecords_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `businesses_owner_external_idx` ON `businesses` (`ownerId`,`externalId`);--> statement-breakpoint
CREATE INDEX `businesses_owner_dedupe_idx` ON `businesses` (`ownerId`,`deduplicationKey`);--> statement-breakpoint
CREATE INDEX `businesses_owner_city_idx` ON `businesses` (`ownerId`,`city`);--> statement-breakpoint
CREATE INDEX `category_profiles_owner_idx` ON `categoryProfiles` (`ownerId`);--> statement-breakpoint
CREATE INDEX `runs_owner_created_idx` ON `prospectingRuns` (`ownerId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `runs_status_idx` ON `prospectingRuns` (`status`);--> statement-breakpoint
CREATE INDEX `raw_results_run_idx` ON `rawSearchResults` (`runId`);--> statement-breakpoint
CREATE INDEX `raw_results_provider_id_idx` ON `rawSearchResults` (`provider`,`providerRecordId`);--> statement-breakpoint
CREATE INDEX `run_events_run_created_idx` ON `runEvents` (`runId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `run_prospects_run_idx` ON `runProspects` (`runId`);--> statement-breakpoint
CREATE INDEX `run_prospects_business_idx` ON `runProspects` (`businessId`);--> statement-breakpoint
CREATE INDEX `run_prospects_priority_idx` ON `runProspects` (`priority`);--> statement-breakpoint
CREATE INDEX `scoring_profiles_owner_idx` ON `scoringProfiles` (`ownerId`);--> statement-breakpoint
CREATE INDEX `search_profiles_owner_idx` ON `searchProfiles` (`ownerId`);--> statement-breakpoint
CREATE INDEX `usage_owner_created_idx` ON `usageRecords` (`ownerId`,`createdAt`);
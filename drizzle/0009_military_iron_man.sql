CREATE TABLE `handoffIntegrations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`displayName` varchar(160) NOT NULL DEFAULT 'SaaS de auditoría web',
	`webhookUrl` varchar(2048),
	`isEnabled` int NOT NULL DEFAULT 0,
	`lastDeliveryAt` timestamp,
	`lastDeliveryStatus` enum('not_sent','succeeded','failed') NOT NULL DEFAULT 'not_sent',
	`lastDeliveryError` varchar(1000),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `handoffIntegrations_id` PRIMARY KEY(`id`),
	CONSTRAINT `handoffIntegrations_ownerId_unique` UNIQUE(`ownerId`)
);

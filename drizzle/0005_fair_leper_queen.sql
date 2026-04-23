CREATE TABLE `classification_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`rawText` text NOT NULL,
	`category` varchar(64),
	`subCategory` varchar(64),
	`title` text,
	`confidence` varchar(10),
	`syncedTo` json,
	`aiRawResponse` text,
	`noteId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `classification_logs_id` PRIMARY KEY(`id`)
);

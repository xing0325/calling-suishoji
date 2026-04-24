ALTER TABLE `notes` ADD `importanceScore` float;--> statement-breakpoint
ALTER TABLE `notes` ADD `pinToHome` boolean NOT NULL DEFAULT false;

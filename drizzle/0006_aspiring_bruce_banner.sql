DROP TABLE `classification_logs`;--> statement-breakpoint
DROP TABLE `diaries`;--> statement-breakpoint
DROP TABLE `email_verifications`;--> statement-breakpoint
DROP TABLE `login_logs`;--> statement-breakpoint
DROP TABLE `notes`;--> statement-breakpoint
DROP TABLE `push_subscriptions`;--> statement-breakpoint
DROP TABLE `schedules`;--> statement-breakpoint
DROP TABLE `streaks`;--> statement-breakpoint
ALTER TABLE `users` DROP INDEX `users_username_unique`;--> statement-breakpoint
ALTER TABLE `users` DROP INDEX `users_email_unique`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `username`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `passwordHash`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `emailVerified`;
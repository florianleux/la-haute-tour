CREATE TABLE `inventory` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`spell` text NOT NULL,
	`obtained_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `inventory_user_idx` ON `inventory` (`user_id`,`obtained_at`);--> statement-breakpoint
ALTER TABLE `reservations` ADD `chest` text;
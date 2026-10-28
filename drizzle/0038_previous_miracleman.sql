CREATE TABLE `boss_keys` (
	`user_id` integer NOT NULL,
	`floor` integer NOT NULL,
	`obtained_at` integer NOT NULL,
	`placed_at` integer,
	PRIMARY KEY(`user_id`, `floor`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);

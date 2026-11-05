DROP INDEX `missed_pool_user_floor_idx`;--> statement-breakpoint
CREATE INDEX `missed_pool_user_failed_idx` ON `missed_pool` (`user_id`,`last_failed_at`);
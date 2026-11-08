CREATE TABLE `admin_credit_grants` (
	`id` text PRIMARY KEY NOT NULL,
	`admin_id` text NOT NULL,
	`user_id` text NOT NULL,
	`credits` integer NOT NULL,
	`tier` integer NOT NULL,
	`reason` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`admin_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `grants_user` ON `admin_credit_grants` (`user_id`);
CREATE TABLE `moderation_checks` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`stage` text NOT NULL,
	`asset_key` text,
	`asset_etag` text,
	`policy` text NOT NULL,
	`model` text NOT NULL,
	`endpoint` text NOT NULL,
	`body` text NOT NULL,
	`provider_id` text,
	`state` text DEFAULT 'pending' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`next_at` integer DEFAULT 0 NOT NULL,
	`lease_until` integer DEFAULT 0 NOT NULL,
	`deadline` integer NOT NULL,
	`created_at` integer NOT NULL,
	`usage` real,
	`error` text
);

--> statement-breakpoint
UPDATE credit_packages SET cents=CASE id WHEN 'lite' THEN 890 WHEN 'standard' THEN 1990 WHEN 'pro' THEN 3990 END WHERE id IN ('lite','standard','pro');
